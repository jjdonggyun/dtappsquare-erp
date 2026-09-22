# 근무정책 및 근태 설계 · Phase 2

Phase 2 구현이 완료되었다. 물리 스키마는 `20260911094603_phase2_work_policy_attendance.sql`, 서버 유스케이스는 `src/server/workforce.ts`, 화면은 `/attendance`, `/admin/attendance`, `/admin/work-policies`가 기준이다.

WorkPolicy(code,version)는 근무 시작/종료, 휴식 시작/종료, grace, timezone, 근무요일을 소유한다. 직원은 [effective_from,effective_to) 배정으로 정책을 적용받는다. 한 직원의 중복 기간 배정은 btree_gist exclusion constraint로 거절한다. 새 배정은 기존 열린 구간을 적용 시작일에 닫으며, 사용된 정책의 판정 필드는 변경할 수 없고 새 버전을 추가한다. 회사/조직 휴일 달력은 휴가와 결근 확정 작업을 연결하는 후속 migration에서 추가한다.

AttendanceEvent는 CHECK_IN/CHECK_OUT append-only 기록이며 occurred_at은 정상 브라우저 요청에서 서버시간이다. device_id, 검증 유형/상태, IP, idempotency key를 함께 저장한다. 원격근무·출장과 기기 검증 성공 여부를 동일 개념으로 취급하지 않는다.

DailySummary는 user/work_date unique, first in/last out, 실제 근무분, primary status + flags, 적용 정책 snapshot, UTC shift 경계, 계산 버전을 저장한다. 동일 직원/날짜를 잠그고 event와 summary를 원자적으로 기록한다. 정책 없는 날짜의 출근은 명시적 관리 오류로 처리하고 임의 09시 정책을 적용하지 않는다.

09:00 + grace 5분 정책은 지역 시간의 분 단위를 기준으로 09:05:59까지 정상, 09:06:00부터 지각이다. 야간근무의 근무일은 shift 시작 날짜다. 근무분은 실제 구간에서 휴식 구간 교집합을 차감한다. 미퇴근은 확정 근무시간으로 표시하지 않는다. DST 경계는 명시적 시간 해석 정책을 적용하고 UTC snapshot을 보존한다.

미출근은 출근 이벤트가 없는 화면 상태, 결근은 근무일 마감 후 휴가/공휴일/출장 등을 대조해 확정한 결과다. 현재 Dashboard는 미출근만 표시하며 결근 통계로 합산하지 않는다. 관리자 정정은 별도 correction과 이유·감사 기록을 저장하고 원 event를 변경하지 않는다.

직원은 본인, 팀장은 실제 관리 조직과 하위 조직, HR/Admin은 전사 범위로 조회한다. 출근/퇴근 command도 ACTIVE와 권한을 검증한다. Dashboard는 오늘 출퇴근/근무분/상태, 월별 지각, 팀 현황을 DB 집계로 조회하며 Phase 3 휴가 원장의 잔여량과 승인 휴가 상태도 함께 표시한다.

검증은 grace 경계, 휴식 차감, 정책 기간/이력, 이벤트 idempotency, 타팀 조회 차단, 정정 audit를 실 PostgreSQL/RLS에서 수행한다. 야간 shift 계산은 DB 함수가 다음 날짜 종료시각을 생성하며, 휴일 달력과 DST 자동 회귀 테스트는 결근 확정 기능을 도입할 때 함께 추가한다.

## Phase 10 출퇴근 검증 확장

기본 모드는 회사 공통 `DEVICE_AND_NETWORK`다. `/api/attendance-verification`에서 ACTIVE 직원, 서버가 신뢰한 IP, 활성 CIDR/승인 예외를 확인하고 90초짜리 증거를 만든다. 필요 시 등록 PC의 Agent가 별도 `/api/device-agent/attendance-proof`로 token, timestamp, nonce를 증명한다. 기존 `attendance_command`는 사용자 JWT로 증거와 등록 자산 지급을 다시 확인한 뒤 서버시간으로 이벤트를 원자적으로 저장한다. 검증 실패는 별도 `attendance_verifications`에만 기록되어 daily summary에 영향을 주지 않는다. `OFF` 모드는 운영자가 명시적으로 선택해야만 기존 로그인 방식으로 동작한다.

ADMIN은 `/admin/attendance-verification`에서 회사 공통 모드, CIDR 및 기간·사유가 있는 재택/출장/외근 예외를 관리한다. HR_MANAGER는 현황만 조회한다. 기존 correction은 그대로 유지한다. 운영 및 위협 모델은 `docs/deliverables/2026-09-20/phase10-attendance-trust/`에 기록했다.
