# 출퇴근 신뢰 설계

## 판정 순서

1. 로그인한 ACTIVE 직원과 기존 `ATTENDANCE_READ_SELF`, 적용 근무정책을 확인한다.
2. `attendance.verification`의 회사 공통 모드를 읽고 서버 ingress IP를 CIDR과 대조한다.
3. 필요한 경우 등록 기기의 credential·자산 지급 관계를 검증한다.
4. 짧은 수명의 `attendance_verifications`가 `READY`일 때만 사용자 JWT의 기존 출퇴근 command가 이를 잠그고 소비한다.
5. 출퇴근 시각은 DB 서버시간이며 결과는 기존 event/summary transaction에 기록한다.

모드: `OFF`(기존 로그인 방식), `DEVICE_ONLY`, `NETWORK_ONLY`, `DEVICE_AND_NETWORK`(기본), `REMOTE_APPROVED`(관리자 예외 + 등록 기기). `DEVICE_AND_NETWORK`에서는 사무실 CIDR 또는 승인된 기간 예외와 등록 기기가 필요하다. `NETWORK_ONLY`에는 원격 예외 면제를 적용하지 않는다. 회사 공통 설정으로 구현했고 Work Policy별 override는 후속 검토 대상이다.

## 기록과 실패

`attendance_verifications`는 `PENDING → READY → CONSUMED` 또는 `FAILED` 상태로 남고, 안전한 reason code만 보유한다. 실패는 `attendance_events`에 추가하지 않아 근무시간·출근율을 오염시키지 않는다. 성공한 event는 모드, 상태 `VERIFIED`, 기기 ID, 네트워크 정책/원격 예외/검증 시도 FK를 보유한다. token 원문·hash·nonce는 event/Audit에 저장하지 않는다. 준비된 증거는 90초가 지나면 사용할 수 없고, 정책·기기·네트워크·예외의 변경을 기록 직전에 재확인한다. 동일 요청 키의 재시도는 동일 결과를 반환하고 다른 행동으로 재사용할 수 없다.

관리자의 근태 정정은 기존 `attendance_corrections`로 사유·정정자·시각을 남긴다. 검증 실패를 정상 event로 사후 전환하거나 원 event를 수정하지 않는다.

## 운영상 의미

등록 PC와 회사 네트워크의 조합은 무단 원격 클릭을 어렵게 하지만 물리적 재실이나 본인 직접 조작을 증명하지는 못한다. 승인 예외는 현재 Approval Engine의 새 결재 유형이 아니라 ADMIN이 이유·기간·참조번호를 남기는 최소 구조다. 팀장/인사 업무에 자동 승인된 것으로 간주하지 않는다.
