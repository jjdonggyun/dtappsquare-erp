# Excel Import 준비와 Export

첨부된 인력프로필 화면은 상단의 성명/생년월일/업무경력, 소속/최종학교/전공, 보유 기술 및 하단의 `구분 · 프로젝트명 · 참여기간 · 프로젝트 주요 업무 · 역할` 6열 표다. Export는 이 구조를 유지하고 청색 기본정보 라벨, 연녹색 프로젝트 헤더, 얇은 테두리와 줄바꿈을 적용했다. 직원 1명당 시트 1개이며 프로젝트 경력은 최신순이다. 여러 명 선택 시 한 Workbook에 시트별로 묶는다. 수식처럼 해석될 수 있는 사용자 텍스트는 escape한다.

기존 Excel parser는 `.xlsx` 시트의 B2/D2/F2, B3/D3/F3, B4 및 B~E 프로젝트 행을 읽어 필수값/기간/경력 표기를 검증한다. 실행: `npm run import:workforce-profile -- C:\secure\profiles.xlsx --dry-run`. 결과에는 시트 수·기술/프로젝트 행 수·셀 위치별 오류만 출력하며 개인정보/업무 내용은 출력하지 않는다. DB 쓰기는 없다. 월 단위 참여기간과 Excel의 단순 경력년수는 정확한 일자·기준을 추정하지 않고 Phase 12 검토 대상으로 둔다.

`docs/templates/master-data/`에 8개 Phase 11 헤더 전용 CSV를 추가했다. `npm run import:master-data`는 필수값·enum·날짜·관계·중복·내부 프로젝트 투입 참조를 Dry Run 검증한다. 실제 직원 데이터와 첨부 화면의 개인별 값은 저장소/seed/test fixture에 복사하지 않았다.
