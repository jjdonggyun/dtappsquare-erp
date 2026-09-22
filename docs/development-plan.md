# 단계별 개발계획

첫 작업은 전체 설계와 아래 5개 문서다: architecture, domain-model, database, rbac, development-plan. 설계 보고 후 Phase 1 구현을 시작한다. 한 번에 이후 Phase의 가짜 화면·mock 성공 API를 만들지 않는다.

## Phase 1 — Foundation / Identity / Admin · 완료

Next.js/TypeScript/Tailwind/shadcn 설정, 환경 검증, 공통 오류, Supabase SSR/session refresh. Employee와 Auth 분리, REQUESTED 가입, 이메일 검증, 로그인·로그아웃, 상태 전용 화면. 관리자 승인/반려, 직접 생성, 직원 조회/수정, 조직 tree 생성·이동·리더 지정, 별도 직급/직책, 다중 role/permission 관리. ACTIVE/permission/RLS 이중 통제, 기본 admin dashboard와 개인 profile. 최초 변경부터 audit 기록. 로컬 seed·bootstrap·환경 설정 문서.

검증: 가입 metadata 위조에도 REQUESTED, 관리자 승인 ACTIVE, 비활성/익명 차단, 직원 admin API 거부, 타인 profile·팀 scope, 권한 변경, 마지막 관리자 보호, 조직 cycle/concurrent move, audit 원자성. DB integration + Auth HTTP + page smoke.

## Phase 2 — Work Policy / Attendance · 완료

정책 버전/배정 기간, 정책 이력 exclusion, 서버시간 출퇴근 event/idempotency, UTC/지역날짜 판정 snapshot, 일 요약/정정, 본인·팀·관리자 근태 dashboard와 월 집계를 구현했다. 미출근과 결근을 분리했고 Phase 3의 승인 휴가는 근태 상태에 반영한다. 회사 휴일 달력과 자동 결근 마감 job은 운영정책 확정 후 추가한다. docs/attendance.md.

검증: 09:05 정상/09:06 지각, 휴식 차감, 정책 변경 후 과거 고정, 중복 배정 거절, 정책 없는 날짜 처리, 야간/DST, 중복 이벤트, 정정 audit, 타팀 접근 거절.

## Phase 3 — Leave / Approval / Notification / Email · 완료

휴가 type/기간 검증·잔액 원장·중복 기간 정책, 범용 subject/route/step engine, 조직 리더 route snapshot, 순차 승인·반려·취소, 최종 Leave 확정 원자성. 인앱 알림, durable outbox, SMTP/Resend 실제 adapter, 재시도/실패 기록/dispatcher. docs/approval.md.

검증: 신청·route 생성·팀장 승인·상위 단계·최종 상태, 자기결재/미래단계 거절, 중복 승인 race, 잔액 예약/취소, 이메일 실패에도 commit, dispatcher 재시도/중복 방지.

## Phase 4 — Asset / Assignment / Device · 완료

자산 CRUD/status, 지급·반납 이력, 직원/자산 상세의 현재·과거 이력, 원자적 지급·반납과 알림. 기기 등록 모델·credential hash·revoke 및 향후 Agent API 계약. 실제 Agent는 구현하지 않는다. docs/asset-device.md.

검증: 자산 지급·반납, 열린 assignment unique, 동시 지급 conflict, 상태 전이, 타인 자산 조회 거절, 토큰 노출 차단, audit.

## Phase 5 — Project / Resource · 완료

프로젝트 생애주기·PM, 직원 다중 배정·이력·투입률, 기간별 합산 경고, WARN/BLOCK 정책 경계, 인력/조직/직급/현재·다음 프로젝트/현재·예정 투입률 dashboard. docs/project-resource.md.

검증: 배정·철수·allocation sweep-line, 경계 날짜, 50+50 정상/60+50 경고, 겹치지 않는 기간 오탐 방지, 취소 제외, PM scope, 알림·audit.

## Phase 6 — Dashboard / Audit / Statistics / Operations · 완료

역할별 통합 KPI, 조직/월별 근태·출근율 분모 정의(재직·근무일·승인휴가 반영), 자산/프로젝트/대기인력, audit 검색·보존/권한, 통계 성능·index/EXPLAIN, 접근성/응답형 UI, 통합 E2E, deployment/README 완성, 복구·운영 runbook.

최종 구현은 직원·팀장·관리자 KPI, 월간 정상/지각/결근/휴가 집계, 대기·투입 인력, 프로젝트/자산 현황, 감사 대상·행위 필터, 투입률 WARN/BLOCK 설정을 포함한다. 로컬 빈 DB 재현, 실제 Auth/RLS/RPC 통합 테스트와 production build를 종료 기준으로 사용한다.

## Phase 7 — 직원 업무관리 · 구현 및 로컬 검증 완료

Employee 중심 `daily_work_logs`, `weekly_reports`와 확정 스냅샷을 추가했다. 업무일지 빠른 입력·복사·수정·삭제, ACTIVE 직원 주간보고 대상, 조직 범위 현황, 보고 모드, 프로젝트 상세의 연결된 업무 기록을 제공한다. ProjectAssignment는 보고 대상 조건이 아니다. 상세 설계와 한계는 `docs/work-management.md`를 참조한다.

품질 gate: 로컬 Auth/PostgreSQL에서 RLS·RPC·version·스냅샷 통합 테스트를 통과한 뒤 Phase 8을 진행했다. 전체 검사 결과는 `docs/verification-phase7-9.md`에 기록한다.

## Phase 8 — 법인카드·비용·월 정산 · 구현 및 로컬 검증 완료

카드/할당 이력/프로젝트 비용/영수증/월 정산, 실데이터 Excel, 마감·재개방, 회사 설정, Vercel Cron, 기존 Outbox와 첨부 메일을 확장했다. 카드 전체 번호와 별도 메일 시스템은 만들지 않았다. 상세 설계와 운영 요건은 `docs/corporate-card-expense.md`를 참조한다.

품질 gate: 카드 기간, 비용 금액·관계·RLS, 월 정산 스냅샷·마감, Outbox 중복·실패·재처리·재발송, Excel 셀을 로컬 DB/테스트로 확인했다. 실제 외부 메일 provider 전송은 운영 자격 증명이 없으므로 운영 환경 검증이 남는다.

## Phase 9 — 통합·대시보드·운영 · 로컬 구현

기존 역할별 Dashboard에 업무일지·주간보고·법인카드 현황을 추가하고, 주간보고 확정·월 정산 준비·정산 메일 최종 실패를 기존 인앱 Notification에 연결했다. 새로운 알림/승인 엔진은 만들지 않았다. 운영 Cron·Storage·메일 설정, 전체 회귀와 실제 브라우저 검증이 종료 gate다. 계획 투입률과 실제 프로젝트 업무시간 비교는 후속 분석으로 남긴다.

## Phase 10 — Attendance Trust / 실데이터 입력 준비 · 로컬 구현 및 검증 완료

기존 근태·자산·기기 모델을 연결하여 회사 공통 `DEVICE_AND_NETWORK` 기본 정책, 짧은 검증 증거, 등록 PC token/timestamp/nonce 확인, 관리자 CIDR과 승인 예외, 실패 시도 분리, 출퇴근 최종 RPC 검사를 추가했다. 조직 코드와 13개 빈 CSV 양식 및 쓰기 없는 Dry Run 검증기로 Phase 11 입력을 준비했다. 실제 직원 Pilot이나 운영 배포는 실행하지 않았다. 상세 기록은 `docs/deliverables/2026-09-20/phase10-attendance-trust/`를 참조한다.

로컬 품질 gate는 lint/typecheck/test/build, DB lint, 실제 Auth/PostgreSQL 근태 신뢰 시나리오로 통과했다. 운영 Vercel ingress, 회사 CIDR, Agent 배포·비밀 보관은 배포 전에 별도 검증한다.

## Phase 11 — Project Portfolio / Workforce Profile / Staffing · 로컬 구현 및 검증 완료

직원 마스터와 분리된 인력프로필, 학력·기술·자격·프로젝트 수행경력, 프로젝트별 필요 역할·기술·인원·기간과 실제 투입 연결을 증분 구현했다. 기존 `project_assignments`/`resource_capacity`를 Source of Truth로 재사용한다. PM은 후보의 기술·가용률 최소정보만 탐색하고 전체 인력프로필은 본인·실제 관리 조직·HR/Admin에게만 노출한다. 기존 Excel과 유사한 Export, 감사, 8개 헤더 전용 CSV 및 기존 Excel Dry Run parser를 제공한다. 실제 직원 개인정보는 Import하지 않았다. 설계·검증은 `docs/deliverables/2026-09-20/phase11-workforce-profile/`에 기록한다.

## Phase 12 — 실제 Digital Square Master Data 검토·Import · 미착수

사용자가 제공할 접근 제한 데이터의 Dry Run → 기존 DB 업무키/이메일 충돌 비교 → 관리자 검토 → 백업/Preview → 명시적 Import 순서로 진행한다. 현재 검증기는 DB에 쓰지 않는다. 기존 Auth identity/RLS/RPC/Audit/멱등성을 재사용하며 실제 직원 Pilot은 별도 일정으로 관리한다.

## 모든 Phase의 종료 gate

순서대로 lint → typecheck → test → build를 실행한다. 하나라도 실패하면 수정 후 실패 지점부터 재검증하고 다음 Phase를 시작하지 않는다. 명령, 실행 시각, 결과, 환경 한계를 기록한다. DB/인증을 실행할 환경이 없으면 해당 검증을 통과로 기록하지 않는다. 테스트 목적의 DB fixture와 application mock implementation은 구별한다.

운영 Supabase/Vercel 프로젝트는 명확히 연결된 대상이 있을 때만 적용한다. 사용자 승인 요구를 임의로 추가하지 않지만 대상이 특정되지 않은 원격 DB를 선택하거나 비밀값을 추정하지 않는다. 로컬 구현·설계·검증은 독립적으로 계속 진행한다.

## 기술적으로 주의할 결정

1. Role과 조직 scope를 분리하지 않으면 팀장/PM에게 과도한 접근권이 생긴다.
2. Auth identity 생성과 관리자 활성화는 두 서비스 경계다. REQUESTED를 안전한 중간상태로 사용하고 재시도 가능한 활성화 command로 복구한다.
3. RLS helper 재귀/definer public grant는 직접 SQL 통합 검증이 필요하다.
4. 결재 완료·휴가 잔액·outbox는 단일 DB transaction이어야 한다.
5. 근태는 timezone/야간/정책 snapshot/휴일 없이 신뢰 가능한 결근률을 만들 수 없다.
6. 이메일 exactly-once, 브라우저 MAC 인증, 예정일만으로 실적 투입률 추정은 보장하지 않는다.
7. 임직원 개인 정보, 퇴사 보존, 감사 보존 기간은 조직 운영 정책으로 확정 후 자동 삭제 정책을 도입한다.
8. 관리자 부트스트랩, 마지막 관리자 보호, 원격 preview DB 격리, 복구 가능한 migration이 서비스 운영의 선행 조건이다.
