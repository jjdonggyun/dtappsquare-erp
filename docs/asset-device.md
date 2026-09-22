# 자산 및 기기 설계 · Phase 4

Phase 4 구현이 완료되었다. 물리 스키마는 `20260912154534_phase4_asset_device.sql`, 화면은 `/assets`, `/admin/assets`, `/admin/assets/[id]`, `/admin/devices`, Agent API는 `/api/device-agent/heartbeat`가 기준이다. 자산 유형은 LAPTOP/DESKTOP/MONITOR/PHONE/TABLET/LICENSE/ETC, 상태는 AVAILABLE/ASSIGNED/IN_USE/REPAIR/LOST/RETURNED/DISPOSED다.

Asset는 자산 코드·제조사·모델·serial·구매일·보증만료·상태·메모를 소유한다. 현재 사용자는 owner_id가 아니라 returned_at IS NULL인 assignment에서 파생한다. asset당 열린 assignment 하나만 허용하는 partial unique index가 동시 지급을 방어한다.

지급 transaction은 자산 잠금 → 지급 가능 상태/대상 직원 ACTIVE 검증 → assignment 생성 → ASSIGNED → notification/audit 순서다. 실제 사용 개시를 IN_USE로 전환한다. 반납은 assignment.returned_at/return_condition을 기록하고 자산을 RETURNED(검수 대기)로 전환한다. 검수 결과에 따라 AVAILABLE 또는 REPAIR, 사용 불가는 DISPOSED로 바꾼다. LOST/REPAIR/DISPOSED 자산을 신규 지급할 수 없다. 반납 전 assignment 이력은 삭제하지 않는다.

직원 상세는 본인 현재·과거 지급 이력, 자산 상세는 과거 사용자 이력을 제공한다. ASSET_MANAGER는 자산 전체를 관리하지만 직원의 민감한 인사정보를 조회하는 권한은 갖지 않는다.

RegisteredDevice는 device UUID, asset 연결, hostname, serial, OS, mac_hash, token_hash, registered/last_seen, active와 row version을 소유한다. credential 변경 횟수인 `token_version`은 Phase 10에서 추가했다. browser MAC 수집이나 브라우저에서 받은 임의 device UUID를 VERIFIED로 신뢰하는 방식은 사용하지 않는다.

등록 API는 256-bit token을 생성해 한 번만 표시하고 서버는 hash만 보관한다. heartbeat는 공개 브라우저 credential을 사용하지 않고 server-only service client와 DB token 비교를 거친다. MAC 원문과 token은 audit에 저장하지 않는다. Phase 4 시점의 실제 Agent 프로그램, token rotation, nonce·timestamp replay 방지와 edge rate limit은 당시 후속 작업으로 남겼다.

종료 테스트: 지급·반납·검수 상태 전이, 동시 지급, 이력 조회 scope, 등록/폐기된 credential, 비밀 필드 DTO 제외, audit 및 lint/typecheck/test/build.

## Phase 10 연결

출퇴근 검증용 경량 Node Agent 예제 `scripts/device-agent.mjs`와 전용 proof API를 추가했다. 기존 `registered_devices`/현재 자산 지급 관계를 검증하고 credential hash, token version, timestamp ±60초, 기기별 nonce를 사용한다. 브라우저에는 token을 전달하지 않는다. 기록 직전 폐기·token 교체·반납을 재검사한다. 기존 heartbeat는 출퇴근 proof로 사용하지 않으며 Windows 서비스 패키징과 heartbeat replay 방지는 후속 운영 과제다.
