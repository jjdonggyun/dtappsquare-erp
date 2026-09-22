# 구현 요약

## 기존 기능 재사용

기존 `attendance_events`, `attendance_daily_summaries`, `attendance_corrections`, `registered_devices`, `assets`, `asset_assignments`, `company_settings`, RBAC/RLS, Audit와 `private.attendance_command`를 확장했다. 원 이벤트 수정과 새 근태·기기·승인 엔진은 만들지 않았다. 검증된 출퇴근만 기존 summary에 반영된다. 관리자 정정은 기존 correction 경로와 사유·감사 기록을 사용한다.

## 데이터베이스

Forward-only migration 5개를 추가했다.

1. `20260920102431_phase10_attendance_trust.sql`: `attendance_network_policies`, `attendance_remote_exceptions`, `attendance_verifications`, `attendance_device_nonces`; RLS/인덱스/제약/Audit; 기기 token version; 출퇴근 이벤트의 network/remote/proof FK; 검증 RPC와 기존 command 확장.
2. `20260920102755_phase10_attendance_security_read.sql`: 권한이 있는 관리자의 설정 조회 RPC.
3. `20260920103130_phase10_master_data_keys.sql`: 기존 행을 유지하는 nullable `organizations.code`와 unique 제약.
4. `20260920103441_phase10_revoke_trigger_execute.sql`: token-version trigger 함수의 anon 실행권 회수.
5. `20260920115654_phase10_attendance_retry_guard.sql`: 출퇴근 멱등 재시도와 검증 이후 네트워크 중지 재검사.

기존 migration은 편집하지 않았다. `database.types.ts`를 로컬 schema에서 재생성했다.

## 서버·화면

- `POST /api/attendance-verification`: 로그인/ACTIVE/권한과 요청 origin을 확인하고 서버가 신뢰한 IP로 90초짜리 검증 시도를 준비한다.
- `POST /api/device-agent/attendance-proof`: 기기 증명을 처리한다. 서비스 권한 RPC는 이 두 서버 경로에서만 보조 증거 생성에 쓰며, **실제 근태 mutation은 기존 사용자 JWT의 `attendance_command`로 실행**한다.
- `POST /api/attendance-security`: 관리자 정책·CIDR·예외 저장. 버전 충돌을 검사한다.
- `/attendance`: 준비 상태, 기기/네트워크 확인, 재시도, 출퇴근 기록.
- `/admin/attendance-verification`: 정책·네트워크·원격 예외, 당일 성공/실패 시도.
- `scripts/device-agent.mjs`: 회사 PC에서 실행할 수 있는 최소 Node loopback Agent 예제. 브라우저에 credential을 전달하지 않는다.

## 권한

`ATTENDANCE_VERIFICATION_READ`는 ADMIN·HR_MANAGER, `ATTENDANCE_VERIFICATION_MANAGE`는 ADMIN에 명시적으로 부여했다. 관리 command는 ACTIVE와 permission을 DB에서 재확인하고 변경을 감사한다. 검증 시도는 본인 또는 조회 권한자만 RLS로 읽으며, nonce는 사용자에게 공개하지 않는다.
