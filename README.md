# Digital Square ERP

Next.js App Router / TypeScript / Tailwind CSS / shadcn/ui / Supabase Auth / PostgreSQL로 구축하는 사내 통합 업무관리 시스템입니다.

Phase 1~6의 운영 기능을 구현했습니다. 인증·인사·조직·RBAC, 근무정책·근태, 휴가·범용결재·알림·이메일 outbox, 자산·장치, 프로젝트·리소스 계획, 역할별 Dashboard·감사·통계를 실제 Supabase RLS와 transaction RPC로 연결합니다.

## 설계 문서

- [Architecture 및 권장 디렉터리](docs/architecture.md)
- [전체 ERD / 주요 Entity / 5개 Sequence Diagram](docs/domain-model.md)
- [DB 제약·인덱스·이력·트랜잭션](docs/database.md)
- [RBAC / RLS 접근권한](docs/rbac.md)
- [Phase별 계획과 종료 기준](docs/development-plan.md)
- [실행·배포 및 운영](docs/deployment.md)
- [Phase 2 검증 결과](docs/verification-phase2.md)
- [최종 검증 결과](docs/verification-final.md)

## Phase 1 구현

- 가입 REQUESTED, 이메일 확인, 로그인/로그아웃, 비활성 계정 상태 화면
- 관리자 직접 직원 생성, 승인/반려/정지/퇴사, 별도 직원 프로필과 버전 충돌 방지
- 조직 tree, 상위 조직 변경, 리더 지정, 직급/직책 별도 관리
- 다중 Role/Permission 관리, 메뉴·서버·DB 권한 검증, 조직 리더 범위 제한
- 관리자/팀장/직원 기본 Dashboard, 내 프로필, 직원 상세, 감사 기록
- RLS, 제한된 RPC, 불변 감사 기록, 마지막 ADMIN 보호, 조직 순환 방지
- DB migration, 타입 생성 결과, 로컬 seed와 실제 Auth/PostgreSQL 통합 테스트

## Phase 2 구현

- 불변 정책 버전, 직원별 [시작일, 종료일) 배정 이력과 기간 중복 방지
- 서버 UTC 시각 기반 CHECK_IN/CHECK_OUT 이벤트, 요청 중복 방지, 당시 정책 연결
- 정책 snapshot·shift UTC 경계·상태 flag·계산 버전을 보존하는 일별 집계
- 원본 이벤트를 유지하는 관리자 보정 이력과 Audit Log
- 직원 내 근태, 팀/관리자 근태 현황, 근무정책 관리, 역할별 Dashboard KPI
- 표준 09:00~18:00 및 10:00~19:00 개발 정책/배정 seed

## Phase 3~6 구현

- 휴가 잔액 원장, 조직 리더 결재경로 snapshot, 순차 승인·반려·취소, 근태 휴가 반영
- 인앱 알림, durable email outbox, Resend/SMTP provider, 실패 기록과 재시도 lease
- 자산 원장, 지급·반납 이력, 직원/자산 상세, 장치 토큰 hash와 Agent heartbeat API
- 프로젝트 원장, 다중 프로젝트 투입, 기간별 투입률 경고, WARN/BLOCK 운영 설정
- 직원·팀장·관리자 Dashboard, 월간 근태 지표, 리소스 계획, 감사 로그 검색

## Phase 7~9 확장

- Employee 중심 업무일지와 주간보고, 확정 스냅샷, 회의용 보고 모드, 프로젝트 업무 기록 연결
- 법인카드 및 프로젝트 할당 이력, 비용·비공개 영수증, 월 정산과 실데이터 Excel
- 기존 Email Outbox/Provider에 첨부파일과 월 정산 Cron 연결, 역할별 Dashboard·인앱 알림 확장
- 상세 설계: [업무관리](docs/work-management.md), [법인카드·비용](docs/corporate-card-expense.md), [검증 기록](docs/verification-phase7-9.md)

## 새 PC 최초 설정

Git, Node.js 22.x(22.12 이상), npm, Docker Desktop이 필요합니다. Docker Desktop은 Linux container engine을 실행한 상태여야 합니다. 이 프로젝트의 로컬 Supabase는 다른 프로젝트와 분리된 55320~55324 포트를 사용하므로 해당 포트가 비어 있어야 합니다.

### Docker/Supabase 환경 이전 방식

Docker container나 volume을 PC 사이에서 직접 복사하지 않습니다. 저장소에 커밋된 `supabase/config.toml`, `supabase/migrations/*`, `supabase/seed.sql`과 `package-lock.json`을 기준으로 새 PC에서 환경을 다시 만듭니다. `npx supabase start`의 최초 실행은 필요한 Docker image를 내려받고 container와 local volume을 생성한 뒤 migration과 SQL seed를 적용합니다. 이어서 `npm run seed:local`이 개발용 Auth 계정과 애플리케이션 초기 데이터를 준비합니다.

따라서 새 PC에는 같은 schema와 재현 가능한 기본 데이터가 만들어지지만, 기존 PC에서 임시로 입력한 로컬 DB 데이터·업로드 파일·Mailpit 메일은 자동으로 옮겨지지 않습니다. 공유해야 할 개발 데이터는 개인정보와 비밀값을 제거한 seed로 관리합니다. 실제 로컬 데이터 이전이 꼭 필요하면 Git에 넣지 말고 별도 암호화 백업으로 취급해야 하며, Supabase 관리 schema(Auth·Storage 등)는 일반 data dump만으로 완전히 복제되지 않습니다.

`supabase/.temp`, Docker volume, `.env.local`은 PC별 상태이므로 복사하거나 커밋하지 않습니다. Docker Desktop에는 Supabase local stack이 사용할 수 있도록 메모리를 최소 7GB 이상 할당하는 것을 권장합니다.

```powershell
git clone https://github.com/jjdonggyun/dtappsquare-erp.git
Set-Location dtappsquare-erp
node --version
docker version
npm ci
npx supabase start
Copy-Item .env.example .env.local
npx supabase status
```

`npx supabase status` 결과를 보고 `.env.local`의 다음 값을 채웁니다.

- API URL → `NEXT_PUBLIC_SUPABASE_URL`
- publishable key(또는 legacy anon key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- service role key → `SUPABASE_SERVICE_ROLE_KEY`
- 개발 계정에 사용할 12자 이상의 별도 비밀번호 → `SEED_PASSWORD`

`APP_URL=http://localhost:3000`과 실제 브라우저 주소를 일치시킵니다. `TEST_DATABASE_URL`은 기본 로컬 포트(55322)를 그대로 사용합니다. `.env.local`에는 service role key, 개발 계정 비밀번호, 도구가 발급한 임시 token 등이 들어갈 수 있으므로 private 저장소에도 커밋하지 않고 PC마다 새로 만듭니다. 팀에서 공유해야 하는 운영 비밀값은 저장소가 아닌 승인된 비밀 관리 도구로 전달합니다.

초기 데이터와 개발 서버를 준비합니다.

월 정산 자동 실행은 운영 환경에서 `CRON_SECRET`(32자 이상), 메일 provider와 `/admin/card-settlements`의 수신자·발송 설정이 필요합니다. 로컬 기본값은 자동 발송 OFF입니다.

```powershell
npm run seed:local
npm run dev
```

이후 다시 실행할 때는 Docker Desktop을 시작하고 `npx supabase start`, `npm run dev`만 실행하면 됩니다. 로컬 서비스를 종료하려면 `npx supabase stop`을 사용합니다. Docker 연결 오류가 나면 Docker Desktop의 Linux engine이 실행 중인지 먼저 확인합니다.

- 앱: [localhost:3000](http://localhost:3000)
- DB 관리: [Supabase Studio](http://127.0.0.1:55323)
- 가입 확인 메일: [로컬 Mailpit](http://127.0.0.1:55324)

| 로컬 계정 | 역할 |
|---|---|
| admin@digitalsquare.local | ADMIN + EMPLOYEE |
| manager@digitalsquare.local | TEAM_MANAGER + PROJECT_MANAGER + EMPLOYEE, Web팀 리더 |
| employee@digitalsquare.local | EMPLOYEE, Web팀 |

비밀번호는 `.env.local`의 `SEED_PASSWORD`입니다. seed는 반복 실행 가능하며 기존 사용자의 비밀번호를 변경하지 않습니다. seed는 loopback URL에서만 동작하고 원격 DB를 거절합니다. 운영 계정을 이 seed로 만들지 않습니다.

## 검증

로컬 Supabase와 seed가 준비된 상태에서 순서대로 실행합니다.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Production HTTP 확인은 `npm start`를 별도 터미널에서 실행한 다음 `npm run test:http`로 진행합니다. 익명/직원/관리자 Auth cookie, Admin API 차단, CSRF, 입력 검증, SSR Dashboard를 검사합니다.

```powershell
npx supabase db lint --local --level warning --fail-on warning
```

Supabase Security/Performance Advisor는 운영 프로젝트 연결 후 Dashboard 또는 관리 API에서 별도로 확인합니다. 통합 테스트는 실 Supabase Auth와 PostgreSQL을 사용합니다. 로컬에서 자신이 생성한 테스트 데이터만 teardown에서 정리합니다. 운영 앱에는 이력 삭제 기능이나 권한이 없습니다. DB가 없으면 통합 테스트는 실패하며 자동으로 skip하거나 mock으로 대체하지 않습니다.

## 구조

`src/modules/*/domain`은 순수 업무 규칙, `application`은 유스케이스/입력 계약, `infrastructure`는 데이터 접근입니다. `src/server/management.ts`는 각 도메인 command를 조합하는 서버 composition root이며 SQL mutation은 단일 transaction RPC로 전달합니다. `src/components`는 입력/표시만 담당합니다. Supabase generated types는 `src/shared/infrastructure/supabase/database.types.ts`에 있습니다.

일반 API는 사용자 세션을 사용합니다. Service Role Key는 `server-only` provisioning client에만 접근하며 client component에서 import하면 Next.js build가 실패합니다. `NEXT_PUBLIC_` 접두사에 비밀키를 넣지 않습니다.

## Phase 10 출퇴근 신뢰·Phase 11 입력 준비

근태 기본 정책은 등록 회사 PC와 허용 네트워크를 함께 요구한다. 관리 화면은 `/admin/attendance-verification`이며, 경량 로컬 Agent 예제는 `npm run agent:local`로 실행한다. 실제 운영 IP·기기 credential 설정 전에는 출퇴근이 차단된다. 검증 결과, 설정 순서와 미해결 운영 항목은 [Phase 10 산출물](docs/deliverables/2026-09-20/phase10-attendance-trust/README.md)에 있다.

실데이터 입력용 [빈 CSV 양식과 작성 가이드](docs/templates/master-data/README.md)를 제공한다. `npm run import:master-data -- C:\secure\master-data`는 오류/경고를 검증할 뿐 DB에 쓰지 않는다. 실제 Import와 직원 Pilot은 아직 수행하지 않았다.

## 운영 배포

코드와 Vercel 프로젝트 연결은 준비되어 있습니다. 운영 Supabase 프로젝트 생성, migration 적용, 첫 ADMIN bootstrap, Vercel 환경변수 연결 순서는 [배포 문서](docs/deployment.md)를 따릅니다. 로컬 seed는 원격 URL을 거부합니다.
