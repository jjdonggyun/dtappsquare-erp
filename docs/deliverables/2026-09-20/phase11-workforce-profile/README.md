# Phase 11 · Workforce Profile / Project Staffing

2026-09-20 (Asia/Seoul) 로컬 구현. Phase 1~10의 직원·조직·프로젝트·Resource 데이터를 유지하고, 직원 전문 프로필과 프로젝트 인력 수요를 증분 연결했다. 실제 Digital Square 직원 개인정보와 첨부 화면의 예시 값은 Import하지 않았다.

| 문서 | 내용 |
|---|---|
| `implementation-summary.md` | 코드, DB, 화면 변경 |
| `verification.md` | 품질 gate와 로컬 DB 검증 |
| `workforce-profile-design.md` | 직원 프로필과 경력 Source of Truth |
| `project-staffing-design.md` | 인력 수요, 후보 검색, 충원 |
| `rbac-impact.md` | 권한·RLS·개인정보 |
| `excel-import-export.md` | 첨부 양식, Export, Dry Run |
| `phase12-master-data-plan.md` | 실제 데이터 준비와 미구현 적용 단계 |

기존 `project_assignments`를 실배정의 유일한 Source of Truth로 사용한다. PM 후보 조회는 최소 기술·가용률 DTO이며 직원 전체 프로필 접근권을 확장하지 않는다.
