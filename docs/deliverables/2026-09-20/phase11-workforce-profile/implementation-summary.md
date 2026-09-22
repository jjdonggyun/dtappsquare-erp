# 구현 요약

## 기존 기능 확인

Employee/Organization/RBAC/RLS/Audit, Project Dashboard·상세, ProjectAssignment, Resource Board/Timeline/Capacity/Heatmap, WBS/Milestone/Issue, Daily Work/Weekly Report를 확인하고 유지했다. Project Resource의 기간별 투입률 계산은 기존 DB 함수를 재사용한다.

## Phase 11 추가

- `modules/workforce-profile`: Zod 명령 계약, Application 정책·Excel·legacy parser, Supabase Repository.
- 인력프로필 화면 `/workforce-profiles/me`, `/workforce-profiles/[id]`: 직원 마스터 읽기 전용, 경력 기준일/요약/학력/기술/자격/수행경력 작성, 현재·예정 프로젝트 조회, 단일 Excel Export.
- 프로젝트 상세 `인력 계획`: 역할·인원·기간·투입률, 필수/우대 기술, 후보 기술·경력·가용률 검색, 실제 Assignment 연결/해제, 투입 인력 화면 이동, 권한 있는 프로젝트 팀 묶음 Excel.
- `/admin/workforce-profiles`: 조직 범위 Skill Matrix와 기술 카탈로그 관리. 기존 프로젝트 목록에 필요/충원, Open Issue를 추가했다.
- API: `/api/workforce-profile`, `/api/workforce-profile/candidates`, `/api/workforce-profile/export`. 모두 사용자 세션·CSRF/JSON 검사 및 DB 권한 경계를 사용한다.
- 8개 헤더 전용 Master Data CSV와 기존 Excel 읽기 전용 Dry Run을 추가했다. 실제 직원 행은 없다.

## DB

Forward-only migration 7개(`20260920121433`, `121654`, `123259`, `123725`, `123928`, `124339`, `20260921033826`). 신규 업무 테이블 9개와 멱등 receipt 1개, 인덱스·FK·CHECK·RLS·Audit/Version trigger, 명령/조회 RPC를 추가했다. 기존 적용 migration은 변경하지 않았다. 기존 `resource_capacity()` wrapper는 같은 계산 core를 공유하도록 확장했다. 후보별 프로필 링크는 실제 직원 Scope 판정 결과에 따라 노출한다.

## 운영상 영향

프로젝트 투입 변경은 기존 Resource 화면/명령에서 계속 수행한다. 인력 계획 충원은 실제 Assignment와 별도 연결 기록을 생성해야 1/N에 반영된다. 기존 프로젝트/직원 행은 프로필이 없어도 정상 조회되며 프로필은 처음 저장할 때 생성된다. 수요 기간별 후보 검색은 현재 185일 이내로 제한한다.
