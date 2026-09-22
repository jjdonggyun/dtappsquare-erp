# Digital Square ERP 디자인

참고: 사용자가 제공한 [Digital Square 사이트](https://digital-square.a4942963.chatgpt.site). Sites의 소유자용 읽기 정보를 통해 배포된 디자인 이미지를 확인했다. 원본 사이트는 수정하지 않았다.

2026-09-08 요청에 따라 dark/lime 테마에서 회사 사이트의 white/navy/blue/yellow 언어로 변경했다.

- 기본 배경 #f5f7fa, panel white, 본문 #192638.
- 브랜드 navy #071c35, primary blue #2458db. 노란색 #ffd629는 브랜드 마크와 작은 강조에만 사용한다.
- Pretendard Variable은 로컬 파일에서 next/font로 제공한다. 외부 폰트 CDN 요청이 없다.
- 72px 상단바, 236px 고정 사이드 메뉴, 그룹별 탐색, 작은 화면에서는 메뉴 토글과 overlay를 제공한다.
- ERP 목록은 검색/필터 → 건수 → 정렬된 표 → pagination 순서다. 상태 badge는 색과 텍스트를 함께 표시한다.
- Dashboard는 실제 직원/요청/조직/권한 수치, 재직 직원/가입 요청 탭, 업무 바로가기, 조직별 인원으로 구성한다.
- 카드 모서리와 그림자는 작게 유지하고 폼과 표의 수평 정렬/간격을 통일한다.
- 미래 Phase 기능의 가짜 KPI, 장식용 검색창, 동작하지 않는 알림 버튼은 제공하지 않는다.

모든 mutation은 기존 인증/RBAC/RLS 경계를 유지한다. UI 변경으로 권한 검증이나 status guard를 완화하지 않는다.

Phase 7~9의 업무일지, 주간보고, 법인카드와 정산 화면은 같은 Sidebar/Card/Badge/Table/Form과 white/navy/blue/yellow 토큰을 사용한다. 보고 모드만 회의실 가독성을 위해 Sidebar를 숨기는 별도 최소 레이아웃을 쓴다. 데스크톱에서는 정보 밀도가 높은 2열 패널을 사용하고 좁은 화면에서는 세로로 배치한다.
