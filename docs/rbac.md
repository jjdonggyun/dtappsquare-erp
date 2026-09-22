# RBAC 및 RLS

권한 결정식은 verified auth user AND employee.user_status=ACTIVE AND permission AND resource scope다. Role 이름, Position, Title은 서로 대체할 수 없다. 다중 역할의 permission은 합집합이며 deny rule은 초기 범위에 없다. Status는 모든 역할보다 우선한다.

## 모델

roles(id,code,name,system,active), permissions(id,code,description), role_permissions(role_id,permission_id), user_roles(user_id,role_id,granted_by,created_at). code는 unique하고 join은 composite PK다. 권한 catalog는 migration으로 관리하고 역할·매핑은 RBAC_MANAGE 보유자만 변경한다. ADMIN에 암묵적 전체 허용 wildcard를 적용하지 않고 catalog 권한을 명시적으로 매핑한다.

| 역할 | 기본 권한 | scope |
|---|---|---|
| EMPLOYEE | PROFILE_READ_SELF, PROFILE_WRITE_SELF, ATTENDANCE_READ_SELF, LEAVE_REQUEST, ASSET_READ_SELF, PROJECT_READ_SELF, APPROVAL_READ_SELF, NOTIFICATION_READ_SELF | 본인 |
| TEAM_MANAGER | EMPLOYEE + USER_READ_TEAM, ATTENDANCE_READ_TEAM, LEAVE_APPROVE | 자신이 리더인 조직 및 하위 조직, 현재 결재 담당 step, 관리 조직원의 프로젝트 요약 |
| PROJECT_MANAGER | EMPLOYEE + PROJECT_READ, PROJECT_WRITE, PROJECT_RESOURCE_MANAGE | 자신이 PM인 프로젝트와 배정 직원의 업무용 최소 정보 |
| HR_MANAGER | EMPLOYEE + USER_READ, USER_WRITE, USER_APPROVE, ORGANIZATION_MANAGE, ATTENDANCE_MANAGE, LEAVE_MANAGE, WORK_POLICY_MANAGE, RESOURCE_READ, ASSET_READ, PROJECT_READ_ALL | 회사 전체; 역할 변경 권한은 제외 |
| ASSET_MANAGER | EMPLOYEE + ASSET_READ, ASSET_WRITE, DEVICE_MANAGE | 전사 자산; 지급 대상 직원의 최소 정보 |
| ADMIN | catalog의 모든 권한, RBAC_MANAGE, AUDIT_READ 포함 | 회사 전체 |

TEAM_MANAGER 역할만 있다고 임의 팀을 조회할 수 없다. 실제 organization.leader_user_id와 ancestry를 검증한다. LEAVE_APPROVE도 현재 route에 지정되지 않은 결재를 승인할 수 없다. PM도 프로젝트 임의 PM 변경으로 접근권을 획득할 수 없다. HR 전체 관리 권한과 PM 자신의 프로젝트 권한은 분리한다.

## RLS 정책 표

| 데이터 | SELECT | mutation |
|---|---|---|
| employees | ACTIVE 본인 / USER_READ 전체 / USER_READ_TEAM 관리 조직 | profile RPC의 허용 필드; USER_WRITE HR 필드; USER_APPROVE 상태 전이 |
| account status | 본인 최소 status | 직접 변경 불가 |
| directory | ACTIVE에 이름·조직·직급·직책 최소 공개 | Organization/User RPC |
| organizations/positions/titles | ACTIVE | ORGANIZATION_MANAGE |
| roles/permissions/mappings | ACTIVE catalog / 본인 grant / RBAC_MANAGE 전체 | RBAC_MANAGE RPC |
| work policies/assignments | 본인 적용 / WORK_POLICY_MANAGE | 관리 RPC; 과거 버전 변경 금지 |
| attendance events/summary | 본인 / 관리 조직 / ATTENDANCE_MANAGE | event 기록 RPC, 정정 전용 RPC |
| leave | 본인 / 지정 결재자 / LEAVE_MANAGE | 신청·취소/승인 RPC |
| approvals/steps | requester / 경로 담당자 / APPROVAL_MANAGE | current step RPC, 순서·상태 검증 |
| assets/assignments | 본인 지급 이력 / ASSET_READ | ASSET_WRITE RPC |
| registered devices | 관리자만 credential 필드; 본인 장비는 안전한 DTO | DEVICE_MANAGE; agent 전용 인증 경계 |
| projects/assignments | 본인 참여 / 해당 PM / 관리 조직원 / PROJECT_READ_ALL | PM 자기 프로젝트 / 전사 관리자; 팀장은 관리 조직원의 배정 행만 조회 |
| notifications | 본인만 | 본인 read_at; 생성은 업무 트랜잭션 |
| outbox/delivery | 사용자 직접 조회 불가 | dispatcher 전용 |
| audit | AUDIT_READ | 시스템 trigger insert만; update/delete 불가 |

Status REQUESTED/REJECTED/SUSPENDED/RESIGNED는 업무 테이블 조회 0행 또는 Forbidden. 본인 상태만 private lookup을 통한 account endpoint에서 노출한다. Auth email 확인과 관리자 ACTIVE 승인은 별도 조건이다.

## 보안 구현 기준

DB private helper는 고정 search_path와 fully-qualified table 이름을 사용한다. 권한 helper의 인자는 permission과 resource이며 actor는 auth.uid()에서만 읽는다. API에서 받은 actor ID나 role로 impersonation하지 않는다. 내부 helper EXECUTE는 필요한 role에만 부여한다. anon은 회원가입 Auth API 외 업무 접근권이 없다.

직접 테이블 INSERT/UPDATE/DELETE를 기본 revoke하고 업무 command RPC만 grant한다. SECURITY DEFINER 내부 command도 반드시 ACTIVE/permission/resource scope를 재검증한다. 감사 trigger는 변경된 row를 기록하고 user가 감사 내용을 조작할 수 없게 한다. 조직/권한/status 변경 이후 재발급되지 않은 JWT도 최신 DB 상태에 의해 거절된다.

마지막 ACTIVE ADMIN 유지, 자기 상태 변경 제한, 역할 관리 권한 escalation, RLS recursion, 타인 ID 대입, 타팀/타프로젝트 접근, 익명 실행, 비활성 JWT, SQL 함수 public EXECUTE 누수를 테스트한다. 조직도는 민감정보가 제거된 명시적 projection을 제공하고 RLS 우회 view를 만들지 않는다.

메뉴 숨김은 편의 기능이다. 동일 permission 계약을 page guard/API/application에서 사용하며 DB가 최종 방어한다. 에러는 Unauthorized(401), Forbidden(403), ValidationError(400), NotFound(404), Conflict(409), InternalError(500), requestId로 응답한다. DB 원문은 사용자에게 전달하지 않는다.

## Phase 7~9 명시적 권한

| 범위 | Permission | 기본 Role |
|---|---|---|
| 본인 업무일지 | `WORK_LOG_READ_SELF`, `WORK_LOG_WRITE_SELF` | EMPLOYEE |
| 조직·전사·PM 업무일지 | `WORK_LOG_READ_TEAM`, `WORK_LOG_READ_ALL`, `WORK_LOG_READ_PROJECT` | TEAM_MANAGER, HR_MANAGER, PROJECT_MANAGER |
| 본인·조직·전사 주간보고 | `WEEKLY_REPORT_READ_SELF`, `WEEKLY_REPORT_WRITE_SELF`, `WEEKLY_REPORT_READ_TEAM`, `WEEKLY_REPORT_READ_ALL` | EMPLOYEE, TEAM_MANAGER, HR_MANAGER |
| 법인카드 | `CORPORATE_CARD_READ`, `CORPORATE_CARD_MANAGE` | PROJECT_MANAGER(조회), FINANCE_MANAGER |
| 비용 | `EXPENSE_READ_SELF`, `EXPENSE_WRITE_SELF`, `EXPENSE_READ_PROJECT`, `EXPENSE_READ_ALL`, `EXPENSE_MANAGE` | EMPLOYEE, PROJECT_MANAGER, FINANCE_MANAGER |
| 월 정산 | `CARD_SETTLEMENT_READ`, `CARD_SETTLEMENT_MANAGE`, `CARD_SETTLEMENT_SEND`, `CARD_SETTLEMENT_REOPEN` | FINANCE_MANAGER |

ADMIN에는 위 Permission을 각각 명시적으로 매핑했다. FINANCE_MANAGER는 업무에 필요한 PROJECT_READ_ALL/USER_READ를 추가로 받는다. 조직 범위는 실제 leader_user_id와 하위 조직을 확인하며, PM 범위는 프로젝트 관리자를 확인한다. 외부 수신자 Outbox/첨부파일은 일반 사용자의 직접 테이블 조회 대상이 아니고 `card_settlement_delivery` 및 권한 있는 다운로드 API로만 제공한다.

## Phase 10 출퇴근 검증 권한

`ATTENDANCE_VERIFICATION_READ`: ADMIN·HR_MANAGER. `ATTENDANCE_VERIFICATION_MANAGE`: ADMIN. 정책·네트워크·원격 예외 command는 ACTIVE/permission/version을 DB에서 검사한다. `attendance_verifications`는 본인과 조회 권한자만 RLS로 읽는다. 일반 사용자에게 nonce·credential이나 검증 준비/증명 RPC의 EXECUTE를 부여하지 않는다. 서비스 권한은 서버의 보조 증거 endpoint에 한정하며 실제 출퇴근 기록은 기존 사용자 JWT command다.

## Phase 11 인력프로필·Staffing 권한

EMPLOYEE는 `WORKFORCE_PROFILE_READ_SELF`, `WRITE_SELF`, `EXPORT_SELF`로 본인 전문정보를 관리한다. 본인 RPC는 생년월일 및 legacy 경력 보정 변경을 허용하지 않는다. TEAM_MANAGER는 `READ_TEAM`, `EXPORT_TEAM`을 받지만 실제 `organizations.leader_user_id`와 하위 조직 범위에서만 동작한다. HR_MANAGER/ADMIN은 `READ_ALL`, `MANAGE`, `EXPORT_ALL`로 전사 프로필을 관리한다. `WORKFORCE_PROFILE_STAFFING_READ`는 PM에게 직원 이름·조직·직급·기술·경력 개월수·기간 최저 가용률만 제공하며 전체 프로필 조회 권한을 부여하지 않는다.

`PROJECT_STAFFING_READ/MANAGE`는 프로젝트 담당 PM 및 HR/Admin 역할에 명시적으로 매핑한다. 쓰기 RPC는 담당 프로젝트인지 다시 검사한다. Excel Export는 대상별 `EXPORT_SELF/TEAM/ALL`과 프로필 조회 범위를 재검사하고 기존 `audit_logs`에 actor·대상·시각·생년월일 옵션을 기록한다. 모든 신규 테이블은 SELECT RLS만 허용하며 일반 사용자 직접 mutation은 revoke했다. 익명·INACTIVE는 거부한다.
