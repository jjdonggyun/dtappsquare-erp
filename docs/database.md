# Database 설계

전체 논리 모델은 [domain-model.md](domain-model.md)의 ERD를 기준으로 한다. 물리 migration은 각 Phase에 해당하는 테이블만 순차 도입한다. 현재 설계와 배포된 DB를 구별하고 migration 파일이 물리 schema의 source of truth다.

## 공통 규칙

- PostgreSQL 17 호환, UUID PK(gen_random_uuid), timestamptz UTC, 업무 날짜 date, 시간 time, 금액/투입률 numeric. UI locale ko-KR과 timezone Asia/Seoul은 저장 timezone과 별개다.
- mutable entity: created_at/updated_at, 필요시 archived_at 및 version. append-only event/audit: created_at. update trigger가 updated_at을 갱신한다.
- FK는 기본 ON DELETE RESTRICT. 이력 테이블은 authenticated DELETE 권한을 부여하지 않는다. user_id는 employee identity이며 employees.id와 auth.users.id는 1:1이다.
- 모든 노출 테이블 RLS, authenticated SELECT 명시적 GRANT, command는 RPC. service/dispatcher schema는 Data API 비노출. auth/private schema를 API exposed schemas에 추가하지 않는다.
- query별 FK index, employees(organization_id,user_status), status/date/filter 복합 index. 목록은 최대 page size 제한·정렬 안정화·pagination을 갖춘다. 통계는 필요한 집계만 DB에서 조회한다.
- enum은 공통 Zod contract와 DB CHECK/enum을 맞춘다. 변경은 backward-compatible additive migration을 우선한다.

## 주요 Entity 및 제약

| 테이블 | 주요 필드 / 제약 |
|---|---|
| employees | id FK auth.users RESTRICT; employee_number unique nullable(승인시 필수), name,email,phone,join_date,resignation_date,organization_id,position_id,title_id,employment_type,user_status,profile_image; lower(email) unique; resignation >= join; ACTIVE는 사번·입사일·조직 필요 |
| organizations | id,name,organization_type,parent_id,leader_user_id,sort_order,active; self-parent 금지, recursive cycle 검사; parent/sort index; 삭제 대신 active=false |
| positions/titles | 각각 id,code unique,name,sort_order,active; employee의 별개 FK |
| roles/permissions | id,code unique,name 또는 description; roles active/system |
| role_permissions/user_roles | composite PK, 역방향 FK index; grant actor/time |
| work_policies | code,version unique; check_in/out,break_start/end,late_grace_minutes,timezone,working_days; 사용된 버전 immutable |
| user_work_policy_assignments | user,policy,effective_from/to; [from,to) daterange 중복 exclusion(user_id WITH =,period WITH &&), btree_gist |
| work_calendars/calendar_days | 회사/조직 달력, date unique per calendar, working/holiday override |
| attendance_events | user,event_type,occurred_at,device_id,ip_address inet,verification_type/status,idempotency_key; unique(user,key), index(user,occurred_at) |
| attendance_daily_summaries | unique(user,work_date); first_in,last_out,worked_minutes,primary_status,status_flags,policy_id,policy_snapshot,shift UTC bounds,calculation_version |
| attendance_corrections | summary_id,reason,before/after,actor; append-only |
| leave_requests | user,type,start/end,duration numeric(6,2)>0,reason,status,approval_subject_id unique; end>=start; half day 단일 날짜/0.5 |
| leave_balance_entries | user,leave_type,amount signed,entry_type,reference,idempotency_key unique; 부여·예약·사용·취소를 원장으로 보존 |
| approval_subjects | id,request_type,reference_id; unique(type,reference), 도메인 연결 FK로 registry 생성·연결을 동일 transaction에 수행 |
| approval_routing_policies | type,version,conditions JSONB,active; 승인 경로 생성 정책 |
| approval_requests | subject_id,request_type,reference_id,requester_id,status,current_step_order,route_snapshot; pending subject당 하나 partial unique |
| approval_request_steps | request_id,step_order,approver_type,approver_id,status,approved_at,comment; unique(request,order), order>0 |
| notifications | user,type,title,message,reference_type/id,read_at,created_at; unread(user,created_at) partial index |
| notification_outbox | event_key unique,recipient,template,payload,status,attempt_count,next_attempt_at,lease_until; index(status,next_attempt_at) |
| email_delivery_attempts | outbox_id,attempt,provider,message_id,status,error_code,attempted_at; unique(outbox,attempt) |
| assets | asset_code unique,asset_type,manufacturer,model,serial_number,purchase_date,warranty_end_date,status,memo; serial unique where not null |
| asset_assignments | asset,user,assigned_at,returned_at,assigned_by,return_condition,memo; open asset partial unique; returned>=assigned |
| registered_devices | id/device_id UUID unique,asset_id,hostname,serial_number,mac_hash,os,device_token_hash,registered_at,last_seen_at,active,version; asset당 활성 장치 partial unique |
| projects | project_code unique,project_name,customer_name,description,planned/actual start/end,status,project_manager_id; date ranges valid |
| project_assignments | project,user,project_role,planned/actual start/end,allocation_rate numeric(5,2) CHECK 0..100,status,memo; index(user,planned_start_date,planned_end_date), project/status index |
| company_settings | key,value JSONB,version,updated_by; `project.allocation`의 WARN/BLOCK 정책 |
| audit_logs | actor_user_id nullable(system),action,entity_type,entity_id,before_data,after_data,ip_address,request_id,created_at; index(entity_type,entity_id,created_at), actor/time index |

汎用 reference_type/reference_id는 일반 FK가 불가능하다. 결재는 registry로 보완하며 Leave subject의 request_type/reference_id 일치와 역참조는 제출 transaction에서 검증한다. 알림 reference는 탐색용이며 업무 무결성의 근거로 사용하지 않는다. 운영 audit에서 개인정보는 허용 목록 projection으로 저장하고 비밀번호/토큰은 제외한다.

## 상태 및 트랜잭션

User: REQUESTED → ACTIVE/REJECTED, ACTIVE → SUSPENDED/RESIGNED, SUSPENDED → ACTIVE/RESIGNED. REJECTED 재심은 관리자 REQUESTED 전환을 통해 처리하고 RESIGNED 재입사는 별도 재고용 업무로 확장한다. 회원가입 trigger는 항상 REQUESTED이며 metadata의 status/role을 무시한다.

Attendance Event CHECK_IN/CHECK_OUT, Summary NORMAL/LATE/ABSENT/EARLY_LEAVE/VACATION/HALF_DAY/REMOTE/BUSINESS_TRIP. Leave DRAFT/REQUESTED/APPROVED/REJECTED/CANCELED. Approval PENDING/APPROVED/REJECTED/CANCELED. Asset AVAILABLE/ASSIGNED/IN_USE/REPAIR/LOST/RETURNED/DISPOSED. Project PLANNING/SCHEDULED/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELED. Assignment PLANNED/CONFIRMED/IN_PROGRESS/ON_HOLD/ENDED/CANCELED.

가입은 auth.users INSERT trigger로 profile을 원자적으로 생성한다. 관리자 승인, 권한 변경, 조직 이동은 DB transaction 및 audit trigger를 사용한다. 결재 요청 잠금, 자산 잠금, 투입 제한시 직원 잠금으로 경쟁을 직렬화한다. 네트워크 재시도 command에는 unique idempotency key, 변경에는 expected_version을 사용한다. 상태 조건이 바뀌면 Conflict를 반환한다.

## Seed / Migration / 검증

개발 seed는 Digital Square → 개발본부 → Mendix팀/Web팀, 경영지원팀과 직급·직책·권한 catalog, 09~18/10~19 근무정책, 노트북 3대, 프로젝트 2개와 50% 투입 예시를 제공한다. Auth seed는 로컬 Auth Admin API로 Admin/Team Manager/Employee를 생성하고 근무정책·연차를 배정하며 운영에서 실행되지 않도록 URL/환경 guard를 둔다. 비밀번호와 service key는 저장소에 커밋하지 않는다.

CLI migration new로 생성하고 SQL 검토 → 로컬 DB 적용 → RLS/advisor → integration test 순으로 검증한다. DDL 파괴 변경은 expand/migrate/contract로 분리한다. 데이터 손실 rollback 대신 수정 migration과 사전 backup을 사용한다. CI는 schema 빈 DB부터 재현, 타입 생성 drift 검사, RLS 역할별 SQL 테스트, Next build까지 통과해야 한다. 실제 Supabase Auth와 REST 통합은 로컬 stack에서 추가 확인하며 단위 테스트만으로 production-ready를 선언하지 않는다.

## Phase 7~9 증분 Schema

기존 migration은 변경하지 않았다. `20260919172620_phase7_work_management.sql` 이후 새 migration만 추가했다. `daily_work_logs`는 nullable project/task FK, soft delete, employee/date 및 project/date index, version/audit/RLS를 갖는다. `weekly_reports`는 `(user_id,week_start_date)` unique, 월요일·금요일 제약, JSONB snapshot, status/version/audit/RLS를 갖는다. `work_management_command`, `weekly_report_roster`, `work_log_daily_status`가 쓰기와 집계를 담당한다.

`corporate_cards`, `project_card_assignments`, `expenses`, `monthly_card_reports`를 추가했다. 카드 할당 기간 겹침과 프로젝트/카드/거래일 관계, `numeric(14,2)` 금액, 기준월 unique, 마감월 변경 금지, 재개방 전 미발송 작업 확인을 DB에서 검증한다. `notification_outbox`는 기존 알림 FK와 외부 수신자에 필요한 nullable 열, `monthly_card_report_id`를 증분 추가했다. 기존 Leave Outbox 행은 그대로 유효하다. `company_settings`에는 `corporate_card.settlement` 키를 추가했다. `expense-receipts`와 `card-settlements` Storage 버킷은 private이다. 카드, 할당, 비용, 보고서, 설정 변경은 기존 audit trigger가 기록한다.

## Phase 10 증분 Schema

`attendance_network_policies`는 여러 활성 CIDR을, `attendance_remote_exceptions`는 직원·기간·종류·사유·승인자를 보존한다. `attendance_verifications`는 90초짜리 준비/기기/네트워크 결과와 소비 상태를 담고 `attendance_device_nonces`의 복합 PK는 재전송을 거절한다. 실패 증거는 정상 근태 event에 연결하지 않는다. 성공 event에는 선택적 network/remote/proof FK가 추가되며 기존 행은 migration 없이 유효하다. `registered_devices.token_version`은 credential 변경 시 증가한다. `organizations.code`는 기존 조직 행을 보존하는 nullable unique 업무키다. `company_settings['attendance.verification']` 기본 모드는 `DEVICE_AND_NETWORK`다. 상세 migration 목록은 Phase 10 날짜별 산출물에 있다.

## Phase 11 증분 Schema

`workforce_profiles`는 `employees`와 1:1이며 경력 기준일과 문서화된 legacy 보정 개월수, 제한 생년월일을 보유한다. `workforce_educations`는 직원당 활성 최종학력 1개, `skills`와 `employee_skills`는 기술 카탈로그/보유 기술, `workforce_certifications`는 별도 자격 이력이다. `workforce_project_experiences`의 `INTERNAL_PROJECT`는 `(project_assignment_id,user_id)` FK로 기존 투입을 참조하고 프로젝트명·고객사·기간·역할 복사를 CHECK로 금지한다. 직원별 주요 업무와 기술만 별도 작성한다. `MANUAL_HISTORY`는 과거 이력의 프로젝트명·기간·역할을 직접 보관한다.

`project_staffing_requirements`는 역할·인원·기간·투입률을 보유하고, `project_staffing_requirement_skills`는 필수/우대 기술을 연결한다. `project_staffing_fulfillments`는 실제 `project_assignments`와 요구사항을 연결하여 충원 수를 계산한다. `workforce_command_receipts`는 actor/request ID별 payload hash와 결과로 쓰기 멱등성을 제공한다. 모든 신규 업무 테이블에 RLS, 기존 version/audit trigger 및 검색 index를 적용했다. 범위가 고정된 `workforce_profile_projects`, `project_staffing_candidates`, `workforce_skill_matrix`, `project_portfolio_staffing`은 기존 투입·Capacity 데이터를 읽는다. 후보 검색은 각 결과에 실제 조직 Scope를 적용한 `can_read_profile`을 함께 반환한다. 적용 migration은 `20260920121433`부터 `20260921033826`까지 Phase 11의 forward-only 7개다.
