# 네트워크 검증

## 신뢰 경계

서버가 Vercel production/preview ingress에서 실행될 때만 단일한 유효 `X-Forwarded-For` IP를 사용한다. Vercel은 해당 헤더를 ingress에서 덮어써 spoofing을 막는다고 문서화한다. 로컬·미확인 proxy·복수 IP 헤더는 `UNKNOWN`으로 처리하고 사무실 확인으로 인정하지 않는다. 실제 배포에서 Vercel 앞의 추가 proxy/CDN, 우회 origin, IPv6, NAT 경로를 확인해야 한다. 신뢰 근거: [Vercel Request Headers](https://vercel.com/docs/headers/request-headers).

ADMIN은 `/admin/attendance-verification`에서 여러 활성 CIDR을 등록할 수 있다. 하드코딩한 회사 주소는 없다. IP는 DB의 `inet <<= cidr`로 대조하며 여러 정책이 맞으면 가장 좁은 CIDR을 택한다. 허용 네트워크가 없거나 trusted IP가 없으면 기본 `DEVICE_AND_NETWORK`의 일반 출퇴근은 실패한다. 준비 후 정책이 중지되면 기록 단계에서 다시 거절한다.

## 사무실 밖 근무

ADMIN이 직원·종류(`REMOTE`, `BUSINESS_TRIP`, `OFFSITE`)·시작/종료일·사유·승인 참조를 저장하고 감사한다. 활성 기간에는 `DEVICE_AND_NETWORK`에서만 회사 CIDR을 면제하며 등록 PC 증명은 유지한다. `REMOTE_APPROVED` 모드에서는 유효한 예외가 필수다. 승인이 없으면 네트워크 불일치 또는 소스 불명 상태다. VPN, 원격 데스크톱, 회사망의 프록시를 통해 공인 IP가 회사 CIDR으로 보이는 경우 실제 위치를 식별하지 못하므로 운영 네트워크 정책과 함께 검토해야 한다.
