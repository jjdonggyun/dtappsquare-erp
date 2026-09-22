# Digital Square ERP Architecture

상태: Phase 1~6 구현 완료 기준. 단일 회사용 ERP이며 다중 법인 SaaS는 현재 범위 밖이다. 기본 언어는 ko-KR, 회사 timezone은 Asia/Seoul이다.

## 1. 구조와 기술 결정

Next.js App Router + TypeScript 기반 modular monolith를 사용한다. UI와 서버는 하나의 배포 단위지만 업무 규칙은 domain, 유스케이스는 application, Supabase 접근은 infrastructure에 둔다. 초기부터 마이크로서비스로 분리하지 않으며, 도메인 공개 계약과 outbox 이벤트로 이후 분리 경로를 확보한다. Tailwind CSS + shadcn/ui, Supabase Auth/PostgreSQL, Vercel Node.js runtime을 사용한다. Node.js 22 이상, 패키지는 lockfile로 고정한다.

```text
src/
  app/
    (auth)/login, signup, account-status/
    (workspace)/dashboard, profile, admin/, organizations/
    auth/confirm/route.ts
    api/                          # HTTP DTO, Zod, 공통 오류 변환
  components/ui/                 # shadcn 소스
  components/layout/             # 권한 기반 sidebar, responsive shell
  modules/
    authentication/
    users/
    organization/
    rbac/
    work-policy/
    attendance/
    leave/
    approval/
    notification/
    asset/
    device/
    project/
    project-resource/
    audit/
      domain/                    # 순수 규칙, 상태 전이, repository port
      application/               # 인증 주체를 받는 유스케이스
      infrastructure/            # Supabase repository, RPC adapter
  shared/
    domain/                      # 식별자, 오류, 날짜 계약만
    infrastructure/supabase/     # request-scoped client, server-only admin client
    auth/                        # verified identity + ACTIVE + permission
    validation/
supabase/migrations/             # 순차적 forward migration
supabase/tests/                  # RLS/RPC/트랜잭션 integration tests
tests/                          # domain/service/HTTP tests
docs/
```

아직 구현하지 않은 도메인의 빈 디렉터리나 성공을 반환하는 가짜 API는 만들지 않는다. Repository는 범용 CRUD가 아닌 업무 목적 메서드를 제공한다. 한 모듈은 다른 모듈의 infrastructure를 직접 import하지 않고 application 계약 또는 composition root를 통해 연결한다. React Component는 조회 모델을 표시하고 command를 전달하며 업무 상태를 판정하지 않는다.

## 2. 도메인 경계

| 도메인 | 소유 데이터 / 책임 | 외부 계약 |
|---|---|---|
| Authentication | Auth 세션, 이메일 검증, 가입·초대 | VerifiedIdentity |
| User Management | employee profile, 고용 상태 | EmployeeActivated, EmployeeSuspended |
| Organization | 조직 트리, 리더, 직급·직책 카탈로그 | ancestry, leadership query |
| RBAC | roles, permissions, grants | permission + resource scope |
| Work Policy | 불변 정책 버전, 기간별 배정, 근무일 달력 | resolvePolicy(user,date) |
| Attendance | 이벤트, 일 요약, 정정 이력 | recordEvent, attendance read model |
| Leave | 휴가 신청·잔액 원장 | submit, finalizeApproval |
| Approval | 범용 순차 결재, 경로 snapshot | submit(type,reference), decide |
| Notification | 인앱 알림, email outbox·시도 기록 | durable notification intent |
| Asset Management | 자산 생애주기, 지급·반납 이력 | assign, return |
| Device Management | 등록 기기, 인증 credential | 등록, revoke, heartbeat 인증 |
| Project Management | 프로젝트 일정·PM | project lifecycle |
| Project Resource | 인력 배정·기간별 투입률 | allocation timeline |
| Audit | 변경 전후 기록 | transaction audit context |

## 3. 인증 및 mutation 경계

1. Proxy는 Supabase 쿠키 갱신만 수행한다. 접근 통제의 최종 경계가 아니다.
2. 서버에서 getUser/getClaims로 신원을 검증하고 DB의 employee status와 permission을 조회한다. JWT user_metadata 또는 클라이언트 role은 신뢰하지 않는다.
3. account-status는 비활성 사용자가 본인 상태만 확인하는 예외 경로다. 모든 업무 page/API는 ACTIVE를 요구한다.
4. Mutation은 Zod → application authorization → DB 권한/범위 검증 → 원자적 변경 순서다. 역할·상태·조직 변경은 다시 DB에서 검증한다.
5. 인증된 읽기는 request-scoped Supabase client와 RLS를 사용한다. 세션 응답은 no-store/private, 사용자 데이터를 전역 cache에 넣지 않는다.
6. 복수 테이블 변경은 제한된 DB RPC 트랜잭션을 사용한다. SQL 권한 helper는 비노출 private schema, 고정 search_path, 최소 EXECUTE 권한을 갖는다. RPC wrapper는 SECURITY INVOKER를 우선 사용하며 내부 권한 함수만 명시적으로 승격한다.
7. Service key는 server-only provisioning adapter/운영 도구에서만 사용한다. 일반 업무 mutation에 RLS 우회 client를 사용하지 않는다. 관리자 생성은 Auth 생성 후 profile 활성화로 이어지며 실패 시 REQUESTED 상태에 남기는 안전한 복구 흐름을 사용한다.
8. Cookie mutation API는 same-origin 검증, JSON content type, body size 제한을 적용한다. 비밀번호·토큰·원문 DB 오류는 응답/로그/Audit에 기록하지 않는다.

## 4. 근태 아키텍처

WorkPolicy는 시간·휴식·grace·timezone·근무요일을 가진 불변 버전이다. 배정은 [effective_from,effective_to)로 보관하고 같은 직원의 기간 중복을 DB exclusion constraint로 금지한다. 변경은 새 버전/새 배정이며 과거 판정을 재계산하지 않는다.

CHECK_IN/CHECK_OUT 이벤트는 append-only. 서버 수신시간을 기본 occurred_at으로 사용하고 idempotency key로 재시도를 제거한다. 사용자 요청의 임의 시간을 정상 출근으로 신뢰하지 않는다. 요약은 user + work_date unique이며 적용 policy ID와 판정 입력 snapshot, UTC shift 경계, 알고리즘 버전을 저장한다. 분 단위로 해당 지역 시간을 내림한 뒤 09:05까지 NORMAL, 09:06부터 LATE로 판정한다. 초 단위 정책이 필요하면 새 정책 버전으로 변경한다.

근무일은 policy timezone의 local date다. 야간근무는 shift 시작일에 귀속하고 종료시간이 시작보다 이르면 다음날로 해석한다. DST 중복/누락 시간은 Temporal 계열의 명시적 disambiguation 계약으로 처리하며 저장한 실제 UTC 경계는 고정한다. 근무시간은 실제 구간과 휴식구간의 교집합을 제외하고 음수/미종료 구간을 분리한다. LATE와 EARLY_LEAVE 동시 발생을 잃지 않도록 primary status와 flags를 함께 저장한다. ABSENT는 달력상 근무일의 마감 이후 reconciliation job으로 생성한다. 휴가·공휴일·출장·원격근무를 확인하지 않고 미출근을 결근으로 바꾸지 않는다. 관리자 정정은 원 이벤트를 수정하지 않고 correction과 감사 기록으로 남긴다.

## 5. 범용 결재 및 알림

ApprovalRequest는 request_type/reference_id/requester를 소유하고 Leave 상세 필드를 갖지 않는다. approval_subjects registry가 reference의 존재와 request_type을 보장하고 도메인 테이블은 registry를 FK로 연결한다. type별 application handler가 완료 시 업무 결과를 적용한다. 기본 휴가 경로는 현재 소속 리더이며, 회사 routing policy의 require_parent_approval 조건이 참이면 상위 활성 리더를 추가한다. 자기결재 제외, 동일 리더 중복 제거, 리더 부재 시 HR 대체 담당자를 명시적으로 선택하며 아무도 없으면 제출을 거절한다.

제출 시 리더/정책 버전/결재자 목록을 snapshot으로 고정한다. ApprovalRequest 행을 FOR UPDATE로 잠그고 current_step만 결정한다. pending step은 앞 단계 승인 전 실행할 수 없다. 마지막 승인과 Leave APPROVED, 잔액 확정, audit, notification/outbox는 한 트랜잭션이다. 반려 시 뒤 단계는 CANCELED로 종료한다. 대리결재/담당자 변경은 별도 권한과 감사 기록을 요구한다.

NotificationService의 sendLeaveApprovalRequest/sendLeaveApproved/sendLeaveRejected는 전송 의도를 transaction outbox에 기록한다. EmailProvider.send는 SMTP/Resend adapter로 대체한다. DB commit 뒤 Route Handler가 Next.js `after()`로 dispatcher를 예약하며, 별도 scheduler는 보호된 `/api/internal/email-dispatch`를 호출할 수 있다. dispatcher는 lease + SKIP LOCKED로 가져가 전송하고 실패 횟수·next_attempt_at·안전한 오류 코드·provider_message_id를 저장한다. 지수 backoff, 최대 시도 후 dead-letter를 지원한다. provider가 DISABLED이면 outbox를 소진하지 않는다. 이메일 실패는 업무 commit에 영향을 주지 않는다. at-least-once delivery이며 provider idempotency를 사용하되 SMTP의 완전한 exactly-once는 보장하지 않는다.

## 6. 자산·기기

자산 current owner를 source of truth로 두지 않는다. 열린 assignment(returned_at IS NULL)가 현재 지급 상태이며 asset당 하나만 허용하는 partial unique index로 동시 지급을 차단한다. 지급·반납은 자산 잠금, 상태 전이, assignment 변경, notification, audit가 원자적이다. 반환 후 상태는 상태 검수에 따라 AVAILABLE/REPAIR이며 RETURNED는 수령 직후 검수 대기 상태로 사용한다.

Device는 asset과 연결되며 UUID, hostname, serial, OS, mac_hash, token_hash를 관리한다. 브라우저에서 MAC을 수집하지 않는다. 등록 토큰은 서버가 생성해 한 번만 반환하고 DB에는 SHA-256 hash만 저장한다. `/api/device-agent/heartbeat`는 server-only service client를 통해 UUID와 토큰을 다시 DB에서 검증한다. Agent 실행 프로그램과 근태 인증 결합은 현재 범위 밖이며, 실운영 Agent에는 nonce/timestamp replay 방지와 edge rate limit을 추가한다.

## 7. 프로젝트·리소스

Project와 ProjectAssignment는 다른 aggregate다. 배정은 사용자 여러 프로젝트를 허용하며 allocation numeric(5,2), 0..100. 날짜는 UI에서 양끝 포함, 계산에서는 end+1의 half-open interval로 변환한다. 취소된 배정은 합산하지 않는다. actual 기간이 있으면 현재 실적에 적용하고 planned 기간은 미래 계획에 사용한다. 종료된 실적은 actual_end 이후 제외한다.

기간별 배정률은 겹치는 날짜의 allocation_rate를 합산한다. 최대 100 초과 시 기본 WARN은 저장 결과에 경고를 포함하고, `company_settings`를 BLOCK으로 바꾸면 DB trigger가 transaction을 거부한다. 대기, 투입예정, 투입중, 철수예정, 투입률 초과를 리소스 화면에서 분류한다.

## 8. 운영 및 위험

- 초기 ADMIN은 CLI bootstrap으로만 부여하고 공개 가입에서 관리자 metadata를 받지 않는다. 마지막 ACTIVE ADMIN의 제거·정지를 DB에서 막는다.
- 조직 변경은 자기 부모/후손 부모 금지, 순환 탐지 및 트리 변경 직렬화를 적용한다. 과거 결재 route와 근태 snapshot은 조직 변경으로 갱신하지 않는다.
- 일반 FK는 RESTRICT. Auth 삭제보다 직원 RESIGNED를 사용한다. 감사·근태·배정 이력에 cascade delete를 사용하지 않는다.
- 일반 직원 목록 DTO와 민감한 HR profile을 분리하여 조직도에서 전화번호·고용정보가 과다 노출되지 않게 한다.
- 감사 기록은 최초 관리 mutation부터 도입한다. Phase 6는 감사의 시작이 아니라 검색·통계·운영 화면의 확장이다.
- 휴가 잔액은 법규를 임의 추정하지 않고 부여/조정/예약/사용/취소 원장으로 계산한다. 초기 부여는 HR 입력, 자동 발생 정책은 회사 확정 후 추가한다.
- RLS는 행 보호이며 열 보호는 별도 DTO/view/column grant로 다룬다. 보안 helper 재귀, SECURITY DEFINER 권한, direct REST mutation 모두 integration test 대상이다.
- Vercel Preview와 Production은 별도 Supabase 환경을 사용한다. migration은 CI 단일 실행, backup/PITR 및 복구 리허설 후 rollout한다. 운영용 계정/SMTP/도메인 연결 전에는 배포 완료로 표시하지 않는다.

## 참고

## 9. Phase 7~9 확장

업무일지는 Employee aggregate다. Project 및 WBS는 nullable 참조이며 WeeklyReport는 Employee + Monday week로 유일하다. 확정 보고의 업무 행은 JSONB snapshot으로 고정한다. Attendance/Leave는 별개 source of truth다. 주간보고 대상의 승인 휴가 확인에는 기존 Leave 데이터를 읽고 새 휴가·달력 도메인을 만들지 않는다.

법인카드와 Expense는 기존 프로젝트를 참조하며 카드 재배정은 기간 이력으로 보존한다. 프로젝트 비용 summary와 일일 업무 작성률은 DB aggregate RPC로 계산한다. 월 정산 Excel은 report snapshot에서 생성해 private Storage에 보관하고 checksum을 DB에 기록한다. 자동 실행만 service role을 사용하는 내부 route로 격리한다. 일반 카드·비용·설정 mutation은 ACTIVE/RBAC/RLS/RPC/version과 기존 audit를 거친다. EmailProvider는 선택적 첨부파일만 확장하고 Outbox와 delivery attempts는 재사용한다.

Phase 7~9 상세 계약은 `docs/work-management.md`, `docs/corporate-card-expense.md`, `docs/verification-phase7-9.md`에 있다.

- [Next.js 인증과 DAL](https://nextjs.org/docs/app/guides/authentication)
- [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase changelog](https://supabase.com/changelog): 2026-09-07 확인. Node 22+, Data API 명시적 grant, public schema 자동 노출 변경을 반영한다.

## Phase 10 근태 신뢰 경계

사용자 JWT가 출퇴근 command의 최종 권한 경계다. 서버 전용 service client는 신뢰한 ingress IP와 Agent 증거를 짧은 `attendance_verifications` 행으로 만드는 두 보조 endpoint에만 사용한다. DB command가 같은 직원/행동/모드, 만료, 현재 등록기기·자산·네트워크·예외를 재검증하고 원래 attendance event/summary transaction을 수행한다. 실패 시도는 별도 증거 테이블에 남는다. 브라우저·Agent가 선언한 IP, MAC, 위치, client time은 출근 사실로 간주하지 않는다. 상세 위협 모델은 날짜별 Phase 10 산출물을 참조한다.

## Phase 11 모듈 경계

`modules/workforce-profile`의 domain은 입력 계약·경력 표시 계산, application은 명령 정책·Excel/legacy 양식 처리, infrastructure는 사용자 JWT Supabase 조회/RPC Adapter를 담당한다. 일반 쓰기는 `workforce_profile_command`에서 ACTIVE/permission/resource/version/idempotency를 검사한다. Project Resource의 용량 계산은 기존 `resource_capacity()`와 동일한 DB core를 공유하며 프런트엔드에 별도 계산 엔진을 두지 않는다. 내부 프로젝트 경력은 읽기 전용 scoped RPC로 Project/Assignment의 최신 값을 표시한다. Excel은 서버에서 생성하여 로그인 사용자에게 private/no-store 응답으로 전달하고 기존 Audit에 기록한다.
