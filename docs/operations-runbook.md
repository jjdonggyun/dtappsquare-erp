# Digital Square ERP 운영 Runbook

## 1. 목적

배포, 상태 확인, Phase 6 자동화, 백업·복구, 장애 대응의 최소 절차다. 운영자는 production/preview/local 대상을 명확히 구분하고 원격 DB를 추정해 명령하지 않는다.

## 2. 일일 점검

1. `GET /api/health`가 HTTP 200, `status=healthy`, `database=ready`인지 확인한다.
2. `/reports`에서 최근 운영 알림 실행이 평일마다 COMPLETED인지 확인한다.
3. 알림 수가 급증하면 청구 일정과 미수금 원장을 확인한다.
4. email outbox의 FAILED와 재시도 횟수를 확인한다.
5. 인증, 5xx, DB 연결 오류와 request ID를 모니터링한다.

## 3. Phase 6 운영 알림 스케줄

권장 실행 시각은 회사 영업일 오전 09:00 KST다.

```http
GET /api/internal/operational-alerts
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET`은 32자 이상의 임의값으로 secret manager에 저장하고 URL/query/log에 넣지 않는다. 성공 응답은 청구 예정, 기한 경과 청구, 생성 알림 건수를 반환한다. 동일 일정·청구·수신자 event key는 재실행해도 중복되지 않는다.

Windows Task Scheduler 예시다. secret은 스크립트에 하드코딩하지 않는다.

```powershell
$headers = @{ Authorization = "Bearer $env:ERP_CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "https://erp.example.com/api/internal/operational-alerts" -Headers $headers
```

Vercel Cron은 평일 00:00 UTC(09:00 KST)를 사용하고 production 환경에 `CRON_SECRET`을 설정한다. 플랫폼이 Authorization header를 주입하는지 실제 환경에서 확인한다.

메일 outbox 재시도는 별도 스케줄러가 `POST /api/internal/email-dispatch`를 `EMAIL_DISPATCH_SECRET`으로 호출한다. 운영 알림 응답 뒤 짧은 dispatch도 실행되지만 provider 장애 복구에는 독립 재시도가 필요하다.

## 4. 배포 전 gate

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx supabase db lint --local --level warning --fail-on warning
```

1. DB backup/PITR와 migration 대상 project ref를 확인한다.
2. forward-only migration을 독립 단계에서 적용하고 build 중 자동 적용하지 않는다.
3. `APP_URL`, 허용 Origin, Supabase URL/키, SMTP/Resend, cron secret을 검증한다.
4. health, login, dashboard, 통합 Excel, 견적 PDF, 세금계산서 PDF를 smoke test한다.
5. 직원·팀장·관리자 계정으로 권한 경계를 확인한다.

## 5. 백업·복구

- 운영 Supabase의 backup/PITR 보존기간을 회사 RPO/RTO에 맞춘다.
- 대규모 migration 전 수동 backup과 복원 리허설을 수행한다.
- DB와 private Storage를 함께 복구한다. DB 파일 키만 복구되고 객체가 없으면 첨부를 열 수 없다.
- 이미 적용한 migration을 고치지 않고 보완 migration을 추가한다.
- 복구 후 Auth identity, employee, 역할, private Storage, outbox lease, 프로젝트 마감 snapshot을 표본 검증한다.

## 6. 장애별 대응

### 로그인 실패

Auth 상태, APP_URL/Origin, 이메일 확인, employee ACTIVE, 쿠키 domain/secure 순서로 확인한다. 비밀번호나 토큰을 로그에 남기지 않는다.

### DB/API 5xx

request ID와 안전한 오류 코드로 서버 로그를 찾는다. `/api/health`와 Supabase 상태를 확인하고 적용 migration 목록을 비교한다.

### 알림 자동화 실패

CRON secret, endpoint HTTP status, `operational_alert_runs`, notification/outbox를 확인한다. 같은 날짜 재실행은 안전하다. 해결 후 재실행하고 `/reports`에서 COMPLETED를 확인한다.

### 메일 실패

provider credential, 발신 도메인, outbox의 next_attempt_at/attempt_count/last_error_code를 확인한다. 인앱 알림과 원 업무 transaction은 되돌리지 않는다.

### 잘못된 청구·입금

삭제하지 말고 허용 상태에서 청구 취소, 입금 취소, 재등록을 사용한다. ISSUED 전자세금계산서는 홈택스/ASP 수정발급과 ERP correction 기록을 함께 처리한다.

## 7. 월간 점검

- 법인카드 전월 정산 Excel·체크섬·SENT
- 미수금 aging과 장기 미수
- 프로젝트별 손익과 음수 이익률
- 미완료 검수·문서·마감 후보
- 휴가 잔액 이상과 근태 보정
- 장기 미접속 계정, 퇴사자, revoke되지 않은 장치
- ADMIN·재무·인사 고권한 역할과 감사 로그
- backup 복원 샘플과 private Storage 접근

## 8. 배포 후 확인

1. `/api/health`
2. 로그인/로그아웃과 세션 갱신
3. 직원의 내 데이터, 팀장의 조직 범위, 관리자의 전사 범위
4. Excel 권한별 시트와 기준일
5. 견적/세금계산서 PDF의 한글·페이지·승인 상태
6. 테스트 청구 데이터로 자동 알림과 중복 방지
7. 감사 로그에 민감값이 노출되지 않는지

