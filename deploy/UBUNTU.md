# Ubuntu self-hosted ERP

운영 VM은 `dsadmin@192.168.1.109`, ERP 주소는 `http://192.168.1.109:3200`입니다. 홈페이지 저장소의 `scripts/setup_ubuntu.sh`가 두 앱과 공식 Supabase `self-hosted/v0.8.5`를 함께 설치합니다. [홈페이지 설치 안내](https://github.com/jjdonggyun/dtappsquare/blob/main/deploy/UBUNTU.md)를 따릅니다.

## 빈 DB와 초기 관리자

운영에서는 개발용 `supabase start/reset`이나 `seed:local`을 실행하지 않습니다. tools 이미지에 포함된 Supabase CLI 2.116.0이 명시적 `ERP_DATABASE_URL`에 `db push --skip-vault --yes`로 migration만 적용합니다. 기존 이력은 `supabase_migrations`로 관리합니다. SQL schema/함수/기본 역할·비공개 bucket은 생성하지만 개발용 business seed는 넣지 않습니다.

최초 설치에서만 `scripts/deploy_ubuntu.sh --bootstrap`이 `bootstrap-server.mjs`를 실행합니다. 회사 조직 하나, ACTIVE 관리자 한 명, ADMIN/MEMBER/EMPLOYEE 역할을 생성합니다. 이미 ACTIVE 관리자가 있으면 비밀번호나 회사 정보를 변경하지 않습니다. 기존 비활성 계정은 자동 활성화하지 않습니다. 초기 로그인 값은 `/home/dsadmin/deploy-config/initial-accounts.env`에 있습니다.

운영자는 조직·직급·근무정책·출근 허용 네트워크·휴가/법인카드 등 업무 설정을 별도로 입력합니다. SMTP가 없는 초기 구성은 `EMAIL_PROVIDER=DISABLED`이며 인앱 알림은 계속 사용합니다.

## 환경변수와 연결

- 플랫폼: `/home/dsadmin/platform/supabase`, 프로젝트 이름 `digitalsquare-supabase`
- ERP 설정: `/home/dsadmin/deploy-config/dtappsquare-erp.env`(권한 600, Git/checkout 밖)
- 공개 API: `NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.109:8000`
- 앱: `APP_URL=http://192.168.1.109:3200`
- 공개 publishable key만 Docker build argument로 전달합니다. service role/secret key, 관리자 비밀번호, DB 비밀번호는 runtime/tools 환경변수로만 전달합니다.
- tools는 외부 Docker network `digitalsquare-supabase_default`에 연결해 `supabase-db:5432`를 사용합니다. 이 내부 전용 DB 연결에는 `?sslmode=disable`을 명시합니다. 기본 DB 컨테이너가 TLS를 제공하지 않아 이 옵션이 없으면 CLI가 migration 전에 중단됩니다. URL 비밀번호는 percent encoding합니다. 호스트 DB 포트는 loopback에만 바인딩합니다.

Supabase의 `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`도 실제 VM 주소와 맞춥니다. API_EXTERNAL_URL에는 `/auth/v1`이 포함됩니다. 공개 URL이나 key를 바꾸면 브라우저 번들에 들어가므로 앱을 다시 빌드해야 합니다. 도메인/HTTPS 전환 시 앱과 Supabase의 URL을 함께 변경합니다.

### 사내 가입 승인 방식

현재 사내 ERP는 이메일 소유 확인을 생략하고 관리자 승인만 사용합니다. 플랫폼 `/home/dsadmin/platform/supabase/.env`에서 `ENABLE_EMAIL_SIGNUP=true`, `DISABLE_SIGNUP=false`, `ENABLE_EMAIL_AUTOCONFIRM=true`를 유지합니다. 앱의 `EMAIL_PROVIDER=DISABLED`는 업무 알림용 설정이며 Supabase Auth의 가입 확인 메일 설정과 별개입니다.

플랫폼 설정을 변경한 뒤에는 다음과 같이 인증 컨테이너를 재생성하고 적용값을 확인합니다.

```bash
cd /home/dsadmin/platform/supabase
docker compose --project-name digitalsquare-supabase --env-file .env --file docker-compose.yml --file docker-compose.ubuntu.yml up -d --no-deps --force-recreate --wait --wait-timeout 60 auth
docker exec supabase-auth printenv GOTRUE_MAILER_AUTOCONFIRM
```

마지막 출력은 `true`여야 합니다. 새 가입은 세션을 발급받아 `/account-status`의 승인 대기 화면으로 이동합니다. DB의 신규 employee 상태는 계속 `REQUESTED`이며 관리자가 `/admin/requests`에서 승인해 `ACTIVE`로 바꾸기 전에는 업무 페이지/API/RPC 접근이 차단됩니다.

`ENABLE_EMAIL_AUTOCONFIRM=false`로 이메일 확인을 사용하는 환경에는 실제 SMTP를 먼저 연결해야 합니다. 공식 기본 설정의 `SMTP_HOST=supabase-mail`에 해당하는 서버가 없으면 가입 시 `unexpected_failure`와 `lookup supabase-mail` 오류가 발생합니다. 기존 미확인 계정의 확인 상태는 자동 확인 설정 변경만으로 갱신되지 않으므로 계정별로 확인해야 합니다.

가입 장애는 `supabase-auth`와 ERP의 `app`, `frontend` 로그를 함께 확인합니다. 앱은 가입 실패의 요청 ID와 안전한 Auth 오류 코드/HTTP 상태만 기록합니다. `unexpected_failure` 같은 인증 서버 장애는 HTTP 500, 발송/요청 제한은 429로 응답하며 입력값 오류와 구분합니다. 로그를 공유할 때 이메일과 토큰 등 개인정보·비밀값을 제거합니다.

## 출근 IP와 예약 작업

Nginx만 3200 포트를 공개하고 앱 3000은 Docker 내부에 둡니다. Nginx가 요청마다 `X-DTS-Client-IP`를 실제 연결 IP로 덮어쓰며 앱은 `TRUSTED_CLIENT_IP_HEADER=x-dts-client-ip`일 때 이 헤더만 신뢰합니다. 앱 포트를 직접 노출하면 이 신뢰 조건이 깨집니다. Vercel 배포의 원래 IP 처리 방식은 유지합니다.

인증 응답은 Supabase SSR의 세션 쿠키 여러 개를 포함할 수 있습니다. `deploy/nginx.conf`는 `proxy_buffer_size 16k`, `proxy_buffers 4 16k`, `proxy_busy_buffers_size 32k`를 설정합니다. 기본 헤더 버퍼를 초과하면 Auth 로그에서는 가입/로그인이 200이어도 Nginx는 `upstream sent too big header`와 502를 반환하고 화면에는 연결 오류가 표시될 수 있습니다. `proxy_buffering off`만으로는 응답 헤더 제한이 해제되지 않습니다. 설정 적용 시 `nginx -t`를 통과한 뒤 reload하고, 이미 생성된 계정으로 로그인해 승인 대기와 업무 접근 차단을 확인합니다.

Vercel Cron을 대신하는 scheduler 컨테이너가 매시 월 정산, 평일 09:00 KST 운영 알림을 실행합니다. 메일 provider가 활성화되면 5분마다 outbox를 처리합니다. API는 Bearer `CRON_SECRET`/`EMAIL_DISPATCH_SECRET`을 검증합니다. 예약 작업은 기존 DB의 중복 실행 방지/재시도 동작을 사용합니다.

## 배포

`main` push → `dtappsquare-erp` 라벨의 self-hosted Runner → `scripts/deploy_ubuntu.sh`입니다. 홈페이지와 공유하는 파일 lock으로 빌드를 직렬화하고 Next worker 2개를 사용합니다. Runner는 dsadmin 서비스로 등록하고 설정은 checkout 밖에 유지합니다.

배포는 빌드 → migration → 앱/scheduler 시작 → Nginx 재생성 → `/api/health`와 `/login` 확인 순서입니다. 자동 배포에서는 관리자 bootstrap을 실행하지 않습니다. health는 service-role `system_health` RPC로 실제 스키마를 확인합니다. 성공한 SHA는 `.env.deployed-sha`에 기록합니다.

DB migration은 전진 적용입니다. 이전 앱 이미지로 되돌려도 DB 변경이 취소되지 않습니다. 배포 전 Supabase DB·Storage 파일·설정 키를 백업하고, 운영에서 volume 삭제나 DB reset을 실행하지 않습니다. 최초 소스 디렉터리와 Runner checkout은 독립적이므로 수동 재배포할 때 최신 소스를 먼저 준비합니다.

## 검증 범위

격리된 공식 Supabase/PostgreSQL 17에 59개 migration을 seed 없이 적용하고 관리자 생성·로그인, account_context/RBAC, system_health, 비공개 bucket, 관리 명령 CRUD를 검증했습니다. bootstrap 재실행 시 기존 관리자 비밀번호/조직 보존도 확인했습니다. Node 22 Docker에서 Next production build와 실제 앱 health/login 흐름을 확인합니다. 개발 PC의 기존 Supabase 데이터는 이 검증에 사용하지 않습니다.
