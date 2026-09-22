# 기기 검증

## 증명 경로

`npm run agent:local`은 환경변수 `DEVICE_AGENT_APP_URL`, `DEVICE_AGENT_ALLOWED_ORIGIN`, `DEVICE_AGENT_ID`, `DEVICE_AGENT_TOKEN`(32자 이상), 선택적 `DEVICE_AGENT_PORT`(기본 45873)를 사용한다. 회사 PC의 `127.0.0.1`에만 바인딩하고 허용 origin의 `/proof` 요청을 받는다. 브라우저는 검증 ID만 Agent에 넘긴다. Agent가 기기 UUID, token, 현재 timestamp와 임의 nonce를 ERP 서버로 전송한다. HTTPS 운영 URL을 사용한다.

서버는 `registered_devices`의 active 여부, token SHA-256 hash, `token_version`, 등록 자산의 현재 직원 지급 및 `LAPTOP/DESKTOP` 유형을 검증한다. timestamp 허용 오차는 ±60초, nonce는 기기별 unique다. 오래된 요청·동일 nonce·폐기 기기·타인 지급 자산은 거절한다. 기록 시점에도 token version, active, 자산 지급을 다시 검사한다. Device ID만 복사해서는 통과하지 못한다. 전화·태블릿은 현재 일반 사무실 정책의 승인 기기에서 제외한다.

## 배포와 한계

이 Agent는 검증 프로토콜을 확인하는 **경량 Node 예제**다. Windows 서비스 설치, 자동 갱신, OS 키 저장소/TPM 기반 비밀 보호, MDM 및 단말 무결성 증명은 포함하지 않는다. 환경변수 token을 복사할 수 있는 로컬 관리자·악성코드가 있으면 다른 단말에서 사칭할 수 있다. Origin 확인은 웹페이지의 임의 접근을 줄이지만 로컬 프로세스가 헤더를 흉내 내는 공격을 막지 못한다. 실제 PC 배포 전에 비밀 보관·회수·회전, 기기 등록 절차와 운영 모니터링을 확정해야 한다. 기존 heartbeat API는 출퇴근 증명에 사용하지 않으며 별도의 replay 방지 개선이 필요하다.
