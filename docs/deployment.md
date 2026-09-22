# 실행 및 배포

## 환경

Node 22.12+, Next.js Node runtime. 개발은 `.env.local`, Vercel은 환경별 encrypted environment configuration을 사용한다. runtime environment는 요청 시 검증하고 비밀값을 출력하지 않는다.

| 변수 | 목적 | 공개 가능 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | 예 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | RLS가 적용되는 공개 API key | 예 |
| SUPABASE_SERVICE_ROLE_KEY | 관리자 Auth identity 생성 전용 | 절대 불가 |
| APP_URL | canonical 앱 origin, CSRF/인증 redirect | 서버 설정 |
| COMPANY_TIMEZONE | UI 날짜 표시, Asia/Seoul 기본 | 비밀 아님 |
| TEST_DATABASE_URL | local test/seed DB 연결 | 로컬 전용 |
| SEED_PASSWORD | 로컬 개발 계정 비밀번호 | 로컬 전용 |
| EMAIL_PROVIDER | DISABLED, RESEND 또는 SMTP | 서버 설정 |
| EMAIL_FROM | 업무 알림 발신자 | 서버 설정 |
| RESEND_API_KEY | Resend credential | 절대 불가 |
| SMTP_HOST/PORT/SECURE/USER/PASSWORD | SMTP credential | 절대 불가 |
| EMAIL_DISPATCH_SECRET | outbox dispatcher bearer secret(32자 이상) | 절대 불가 |
| CRON_SECRET | 월별 법인카드 정산 Cron bearer secret(32자 이상) | 절대 불가 |

서버 Supabase client는 request cookies와 사용자 JWT로 동작한다. `provisioningClient`만 service key를 사용한다. Data API exposed schemas에 private를 추가하지 않는다. 일반 DB 쓰기는 table DML grant 없이 SECURITY INVOKER wrapper → 권한을 재검증하는 private function으로 제한한다.

## Supabase 준비

1. Development/Preview/Production 프로젝트를 분리한다. 운영 대상 project ref를 확인하고 CLI를 명시적으로 연결한다.
2. `supabase/migrations`의 Phase 1~9 migration을 이름 순서대로 적용한다. 이미 적용된 파일을 수정하지 않고 보완 migration을 추가한다.
3. `public`의 필요한 SELECT/EXECUTE grant는 migration에 포함되어 있다. private schema는 노출하지 않는다.
4. Supabase Auth의 site URL/redirect allowlist를 해당 앱의 `/auth/confirm`로 설정한다. 이메일 확인 켜기, 12자 이상 비밀번호, secure password change를 사용한다.
5. 운영 Auth 이메일에는 실제 SMTP를 연결하고 발신 도메인을 검증한다. 이 SMTP는 Phase 3 업무 알림용 EmailProvider와 별개다. 가입 이메일은 Supabase Auth가 소유한다.
6. 회원가입 테스트를 통해 Mail 확인 → callback → REQUESTED 화면 → 관리자 승인 → ACTIVE를 확인한다. PKCE `code`와 서버용 `token_hash&type=email` 확인 경로를 지원한다.

## 첫 운영 ADMIN

로컬 seed를 원격에 실행하지 않는다. 프로젝트 소유자가 Supabase Auth 관리 콘솔에서 이메일이 확인된 첫 관리자 identity를 생성하면 employee는 REQUESTED로 생성된다. SQL Editor의 privileged 운영 세션에서 해당 UUID와 회사의 조직/사번/입사일을 지정하고 **같은 transaction**으로 다음을 수행한다.

1. 회사 root 조직이 없으면 실제 회사 정보를 생성한다.
2. employee의 사번·입사일·조직을 설정하고 ACTIVE로 변경한다.
3. user_roles에 ADMIN과 EMPLOYEE를 추가한다.
4. 결과를 조회하고 commit한다. 일반 application은 관리자 없는 초기 상태에서 권한 변경을 허용하지 않는다.

이 과정은 프로젝트 소유자의 최초 bootstrap이며 이후 모든 관리 작업은 앱/RPC를 사용한다. Auth metadata에 ADMIN을 넣는 방식은 작동하지 않는다. 마지막 ACTIVE ADMIN을 제거하는 command는 전체 rollback된다.

## Vercel

Framework Next.js, install `npm ci`, build `npm run build`, Node 22 이상을 사용한다. Production/Preview마다 올바른 APP_URL과 Supabase 환경을 별도 설정한다. 임의 Preview origin wildcard를 production CSRF allowlist에 추가하지 않는다. migration은 Vercel build 안에서 자동 실행하지 않고 독립 CI 단계에서 단일 실행한다. 배포 후 `login`, `account-status`, `dashboard`, Admin API를 실 환경 계정으로 확인한다.

세션 페이지와 응답은 private/no-store이며 권한을 전역 cache에 보관하지 않는다. Proxy는 쿠키 갱신만 하고 page/API/DB에서 상태를 재검증한다. HTTPS, frame-ancestors, nosniff, referrer, permissions policy를 적용한다. 요청 로그는 requestId와 안전한 error code만 기록하며 토큰·비밀번호·원문 DB 오류를 기록하지 않는다.

업무 mutation이 알림 outbox를 commit하면 Next.js `after()`가 응답 이후 짧은 dispatcher 실행을 예약한다. 재시도 주기를 독립 운영하려면 scheduler가 `Authorization: Bearer <EMAIL_DISPATCH_SECRET>`로 `/api/internal/email-dispatch`에 POST한다. dispatcher는 최대 25건씩 lease하며 provider 실패가 원 업무 transaction이나 HTTP 응답을 되돌리지 않는다.

법인카드 월 정산은 `vercel.json`의 매시 Cron이 GET `/api/internal/monthly-card-settlement`을 호출한다. Vercel 환경에 32자 이상의 `CRON_SECRET`을 설정한다. 운영 전 `/admin/card-settlements`에서 자동 발송 사용 여부, 수신자/CC, 매월 발송일·시간(Asia/Seoul)을 저장한다. 초기값은 자동 발송 OFF이므로 설정 전에는 발송하지 않는다. Cron은 설정된 시각 이후 전월 보고서와 비공개 Excel을 생성하고 마감 후 기존 notification outbox에 중복 방지 키로 적재한다. 기존 email dispatcher가 첨부파일을 포함해 전송한다. Cron 일정은 UTC 기준이며 회사 시각 검사는 서버에서 수행한다. 매시 일정이 해당 Vercel 요금제에서 허용되는지 배포 전에 확인한다.

영수증은 `expense-receipts`, 월 정산 Excel은 `card-settlements` 비공개 Supabase Storage 버킷에 저장한다. 다운로드는 사용자 세션과 RLS 또는 서버 권한 검사를 거치며 공개 URL은 발급하지 않는다. 월 정산의 파일 키·SHA-256·발송 상태와 outbox 최근 시도는 관리 화면에서 확인한다. 외부 수신자에게 보내는 실제 첨부 메일은 운영 SMTP/Resend 자격 증명과 도메인 확인 후 별도로 검증한다.

## 실패 복구

- 관리자 직접 생성: Auth 생성 → employee profile 갱신 → ACTIVE command의 경계다. 뒤 단계 실패 시 identity/profile은 REQUESTED로 남고 관리자가 가입 승인 화면에서 복구한다. API를 무조건 재시도해 같은 이메일을 다시 생성하지 않는다.
- 상태/프로필 충돌: version이 오래되면 409. 화면 새로고침 후 변경 내용을 다시 확인한다.
- 조직 비활성화 실패: 활성 직원이나 활성 하위 조직을 먼저 이동한다.
- 권한 잠금: 추가 ADMIN 부여 후 기존 ADMIN을 제거한다. 처음 관리자/운영 복구는 프로젝트 소유자의 감사 가능한 privileged 세션으로 수행한다.
- DB 변경 실패: 이미 적용된 migration을 편집하지 않고 보완 migration을 추가한다. backup/PITR 복구와 이전 앱 버전 호환성을 확인한다.
- 월 정산 실패: 동일 기준월 Cron을 재실행한다. DRAFT/REVIEW는 현재 비용으로 다시 집계하고 Excel을 교체하며, CLOSED는 동일 outbox event key로 재처리한다. 마감 직전 스냅샷과 DB를 대조하므로 불일치하면 비용 재집계 후 다시 마감한다. SENT 재발송은 관리 화면에서 명시적으로 실행한다.

## Phase 10 출퇴근 검증 운영 순서

1. 로컬 검증 결과와 보안 한계를 `docs/deliverables/2026-09-20/phase10-attendance-trust/`에서 확인한다. 운영 DB 적용 전 backup을 확보하고 새 forward-only migration 5개를 순서대로 적용한다.
2. Vercel production/preview의 ingress가 client `X-Forwarded-For`를 덮어쓰는지 실제 요청으로 검증한다. 앱은 해당 환경만 신뢰하며 로컬/미확인 proxy는 `UNKNOWN`으로 처리한다. 추가 CDN·VPN·우회 origin이 있으면 경계를 다시 설계한다.
3. `/admin/attendance-verification`에서 실제 Office 공인 CIDR을 입력한다. CIDR과 등록 회사 PC가 없으면 기본 `DEVICE_AND_NETWORK` 출퇴근이 차단된다. 편의상 `OFF`로 바꾸지 않는다.
4. 회사 PC별 기존 자산 지급과 등록 기기를 확인하고 Agent token을 안전한 채널로 제공한다. `DEVICE_AGENT_APP_URL`, `DEVICE_AGENT_ALLOWED_ORIGIN`, `DEVICE_AGENT_ID`, `DEVICE_AGENT_TOKEN`을 PC별로 구성해 `npm run agent:local`을 실행한다. 현재는 운영 설치 패키지가 아닌 Node 예제이므로 서비스화·비밀 보호·회수 절차를 먼저 확정한다.
5. 개발/Preview 계정으로 성공·실패, 재택 예외, 정정, 관리자 현황을 확인한다. 실제 직원 Pilot과 실데이터 Import는 Phase 10 범위가 아니다.

## 운영 한계

감사 IP는 nullable이며 신뢰 가능한 ingress의 IP 검증 계약을 구성하기 전 임의 client header를 감사 사실로 저장하지 않는다. Device Agent 실행 프로그램, heartbeat replay 방지, 자동 결근 마감 job, 자동 연차 발생 규칙은 회사 운영정책과 별도 실행환경을 확정한 뒤 추가한다.

실제 SMTP 도메인은 운영 provider credential이 없으면 `DISABLED`로 배포할 수 있다. 이때 인앱 알림은 정상 생성되고 email outbox는 PENDING으로 보존되어, provider 연결 후 전송할 수 있다. 실제 provider가 전송을 시도한 뒤 실패하면 안전한 오류 코드와 재시도 시각을 기록한다. 배포 전 backup retention, 계정 MFA, 가입 abuse 방지/CAPTCHA, 개인정보 보존 정책은 운영 환경에 맞게 적용한다.

## Phase 11 적용 순서

운영 적용 전 DB backup/PITR과 Preview에서 `20260920121433`~`20260920124339`의 Phase 11 forward-only migration을 순서대로 검증한다. 새 인력프로필 메뉴는 권한에 따라 보이며 기존 프로젝트/직원/Resource 데이터는 복사하거나 삭제하지 않는다. Excel Export는 private/no-store이고 감사 로그에 대상과 생년월일 포함 여부를 남긴다. 실제 직원 인력프로필 Excel/CSV는 저장소에 두지 말고 접근 제한된 위치에서 `npm run import:workforce-profile -- <file.xlsx> --dry-run` 및 `npm run import:master-data -- <directory>`로 검증한다. 두 명령은 DB에 쓰지 않으며 실제 Import 적용 경로는 Phase 12에서 별도 검토한다.
