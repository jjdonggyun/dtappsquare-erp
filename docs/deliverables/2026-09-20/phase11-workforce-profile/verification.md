# Phase 11 검증 결과

검증 대상은 로컬 Supabase/PostgreSQL과 실제 Supabase Auth 사용자(Admin, Team Manager, Employee), Next.js 16 개발/production build다. 실제 직원 데이터는 사용하지 않았고 seed와 합성 fixture만 사용했다.

## 자동 검증

2026-09-20 1차 및 2026-09-21 재개 후 최종 실행 결과:

| Gate | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과, Next route type 생성 + `tsc --noEmit` |
| `npm test` | 통과, 9 files / 61 tests |
| `npm run build` | 통과, Next.js 16.3.4, 31 static page generation 포함 |
| `npx supabase db lint --local` | 통과, schema error 0 |
| `npm run import:master-data` | 통과, 헤더 전용 21개 CSV / row 0 / error 0 |

날짜 변경 뒤 첫 회귀 실행은 Docker Desktop이 종료되어 Auth/Postgres 연결 오류로 중단됐다. Docker Desktop과 로컬 Supabase를 재시작한 뒤 같은 명령을 다시 실행해 위 최종 결과를 얻었다. 코드 실패로 기록하지 않았다.

## Phase 11 DB 통합 시나리오

- 본인 profile 조회/수정, 타인 수정 거절, 직접 table update 거절.
- 실제 `leader_user_id` 관리 조직 조회와 타 조직 거절, Admin 전사 조회.
- 제한 생년월일은 self RPC payload로 변경되지 않고 관리 권한자만 변경.
- 동일 request ID+payload 재실행 결과 재사용, 다른 payload는 conflict.
- Manual History 생성, Internal Project가 동일 직원 Assignment를 참조하고 프로젝트명·기간·역할 복사를 DB CHECK로 거절.
- EmployeeSkill 저장, 요구 Skill 수준 일치, 관리 조직 Skill Matrix 범위.
- Requirement/Skill 생성, 기존 Resource Capacity 후보 조회, 후보별 실제 프로필 Scope 판정, 실제 Assignment fulfillment, 포트폴리오 충원 수.
- 대상 범위 밖 Export audit 거절, 본인 Export audit 1건 기록.
- 기존 투입/근태/업무일지/주간보고/법인카드/RBAC 회귀 포함 전체 61개 테스트 통과.

## Excel

합성 데이터로 workbook을 생성해 기본정보 셀, 기술 출력, 프로젝트 최신순을 ExcelJS 재로딩으로 검증했다. 생성 workbook을 legacy parser로 다시 읽어 프로젝트 2건을 확인했다. 사용자 첨부 화면의 실제 이름·생년월일·경력 값은 fixture에 사용하지 않았다. Export API는 private/no-store, 대상 최대 20명, 생년월일 제외 기본값과 Audit RPC를 사용한다.

## 브라우저

`npm run dev`를 `http://localhost:3000`에서 실행했다. 실제 Admin 세션으로 다음을 확인했다.

- `/workforce-profiles/me`: 기존 Sidebar/Card/Form 스타일, 경력·학력·기술·자격·프로젝트 경력과 Excel 버튼 표시.
- `/admin/projects/...`: `인력 계획` 탭, 요구사항 추가 및 프로젝트 팀 Export 표시. 후보 프로필 링크는 후보별 Scope가 허용할 때만 표시.
- `/admin/workforce-profiles`: 날짜/조직/직급/기술/경력/가용률 필터, Skill Matrix, 기술 카탈로그 표시.
- 좁은 viewport에서 필터가 3열/다음 행으로 재배치되고 Table이 깨지지 않음.
- 위 요청은 HTTP 200이며 Next error overlay가 보이지 않았고 서버 로그에 runtime error가 없었다.

개발 서버와 로컬 Supabase는 최종 확인을 위해 실행 상태로 유지했다.

## 남은 운영 검증

운영/Preview DB migration, 실제 직원 파일 Dry Run·대조·Import, 운영 개인정보 보존 정책, 고객 제출용 최종 양식 인쇄 검수는 Phase 12에서 수행한다. 현재 legacy Excel parser는 여러 회사 양식 변형이나 `.xls`를 지원하지 않는다.
