# Phase 10 — Attendance Trust / 실데이터 입력 준비

작성일: 2026-09-20 (Asia/Seoul). 범위는 로컬 개발 환경의 구현·검증이다. 실제 직원 Pilot이나 운영 DB 적용은 하지 않았다.

## 산출물

| 문서 | 내용 |
|---|---|
| [implementation-summary.md](implementation-summary.md) | 변경 파일, API, DB 및 기존 기능 연결 |
| [verification.md](verification.md) | 품질 gate와 보안 시나리오 결과 |
| [attendance-security-design.md](attendance-security-design.md) | 검증 정책, 상태, 실패·정정 흐름 |
| [device-verification.md](device-verification.md) | 등록 기기, Agent, 재전송 방지 |
| [network-verification.md](network-verification.md) | 신뢰 IP, CIDR, 원격 예외 |
| [production-gap.md](production-gap.md) | 배포 전 확인할 항목과 한계 |
| [master-data-import-plan.md](master-data-import-plan.md) | Phase 11 입력·검증 순서 |

계속 사용하는 빈 CSV 양식과 작성 가이드는 [`docs/templates/master-data/`](../../../templates/master-data/README.md)에 둔다. `npm run import:master-data`는 검증 전용이며 DB에 쓰지 않는다.

## 현재 상태

기본 검증 모드는 `DEVICE_AND_NETWORK`다. 허용 CIDR과 회사 기기를 관리자가 등록하고 Agent를 실행해야 일반 출퇴근이 가능하다. 미등록 상태를 자동으로 `OFF`로 낮추지 않는다. 실제 Vercel ingress의 IP 전달, PC 배포·토큰 보관, 회사 공인 IP, 운영 계정 권한은 배포 전에 확인해야 한다.
