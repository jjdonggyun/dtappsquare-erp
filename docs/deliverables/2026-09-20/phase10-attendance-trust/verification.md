# Phase 10 검증 기록

환경: Windows / Node 22 / Next.js 16.3.4 / 로컬 Supabase PostgreSQL·Auth, 2026-09-20 Asia/Seoul. 실제 직원·운영 DB·운영 Vercel은 사용하지 않았다.

| 검사 | 결과 |
|---|---|
| `npx supabase db push --local` | Phase 10 forward-only migration 적용 성공 |
| `npx supabase db lint --local --level warning --fail-on warning` | schema error 0 |
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm test` | 8개 파일, 56개 테스트 통과 |
| `npm run build` | Next.js production build 통과 |
| `npm run test:http` | 로컬 Auth cookie/Admin 경계/CSRF/validation/dashboard 9건 통과 |
| `npm run import:master-data` | 빈 canonical 양식 0행, 오류 0, DB 쓰기 없음 |
| 브라우저 `localhost:3000/attendance` | 로그인 Admin 화면 로딩, 기본 정책에서 검증 불가·버튼 비활성 표시 |
| 브라우저 `localhost:3000/admin/attendance-verification` | 정책/CIDR/예외/실패 시도 표시, 오류 화면 없음 |

`tests/attendance-trust.test.ts`는 실제 로컬 RPC/Auth/PostgreSQL에서 정상 기기+CIDR의 VERIFIED event, 직접 RPC 우회 거절, 가짜 XFF, 네트워크 불일치/정책 중지, 미등록·폐기·타인 기기, 틀린 credential, 오래된 timestamp, nonce replay, server time, 멱등 재시도, 관리자 승인 원격 예외를 검증한다. 실패 시도는 event count를 늘리지 않는다. `tests/master-data-validator.test.ts`는 120% 경고, 누락 조직·잘못된 날짜 오류를 검증한다. 테스트 fixture는 로컬에만 만들고 정리했다.

## 검증 범위의 한계

Vercel 실 ingress에서 client IP가 들어오는지, 회사 PC에 설치된 Agent의 비밀 보관, 실제 Office CIDR·VPN·RDP, 운영 rate limit/로그 보존은 로컬 테스트로 입증할 수 없다. 현재 로컬 환경의 IP는 의도대로 `UNKNOWN`이며 일반 출퇴근이 거절된다. Windows 서비스 패키징과 실제 직원 Pilot도 수행하지 않았다.
