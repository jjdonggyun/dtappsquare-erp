# Phase 2 검증 기록

검증 대상은 Foundation/Identity/RBAC와 Work Policy/Attendance의 실제 통합 상태다. 단위 테스트에서 업무 규칙을 확인하고, 로컬 Supabase Auth·PostgreSQL·PostgREST에서 RLS와 transaction RPC를 검증한다.

## 자동 검증 범위

- 회원가입은 위조 metadata와 관계없이 REQUESTED, 관리자 승인 후 ACTIVE
- 비활성·익명·권한 없는 사용자 차단, 팀 리더 조직 범위, 직접 DML 거부
- 09:00 정책과 5분 grace에서 09:05 정상, 09:06 지각
- 09:00~18:00에서 12:00~13:00 휴게를 제외한 인정 근무 480분
- 정책 v1/v2 적용 구간 해석, 과거 summary의 정책 snapshot, 사용 정책 변경 거부
- 동일 idempotency key의 출근 이벤트 한 건 유지
- 타팀 직원의 근태 RLS 차단과 관리 조직 조회 허용
- 관리자 보정 후 원 event 유지, correction과 actor Audit Log 생성
- 모든 public 업무 테이블 RLS와 익명 RPC 실행권 제거

## Phase 종료 명령

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx supabase db lint --local --schema public,private --fail-on warning
npx supabase db advisors --local --type all --level warn --fail-on warn
```

브라우저 검증에서는 관리자 Dashboard, 내 근태의 실제 출근 기록, 근태관리, 근무정책 관리 화면을 확인한다. 출근 후 Dashboard 집계와 월간 기록이 갱신되고 브라우저 console error가 없어야 한다.

휴가/공휴일과 대조한 결근 확정, 이메일과 범용 결재는 각각 Phase 3 범위다. 현재 미출근 수치는 결근 통계로 사용하지 않는다.
