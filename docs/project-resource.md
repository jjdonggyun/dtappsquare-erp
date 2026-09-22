# 프로젝트 및 투입계획 설계 · Phase 5

## 통합 프로젝트·리소스 관리 확장 (2026-09)

기존 `projects` 및 `project_assignments`를 그대로 사용한다. 마이그레이션 `20260919164159_project_planning.sql`과 `20260919164739_project_capacity_access.sql`은 프로젝트에 수동 실제 진행률을 더하고 `project_tasks`, `project_milestones`, `project_issues`를 추가한다. 기존 투입 행은 이관하지 않는다. 새 테이블은 프로젝트 읽기 RLS, 버전 트리거, 감사 로그를 적용한다.

프로젝트 대시보드(`/admin/projects`)는 요약 카드, 검색·필터, 목록과 펼침식 생성 폼을 제공한다. 상세(`/admin/projects/[id]`)는 개요·일정·투입 인력·업무/WBS·이슈/리스크 탭으로 구성된다. `project_assignment.batch`, `project.progress`, `project_task.save`, `project_milestone.save`, `project_issue.save`는 기존 `/api/project-resource` 명령과 권한을 재사용한다. 제거는 삭제 대신 기존 배정 상태 `CANCELED`로 변경해 이력을 보존한다. 일괄 배정은 DB 한 트랜잭션으로 저장한다.

`/admin/resources`는 리소스 보드·타임라인·테이블·월/주 Capacity Heatmap을 제공한다. `/api/resource-capacity`와 `public.resource_capacity(start,end,granularity)`는 최대 186일의 일별 활성 배정(PLANNED/CONFIRMED/IN_PROGRESS)을 DB에서 합산하여 기간별 평균·최고 투입률·최저 가용률을 반환한다. 과투입은 **기간 중 하루라도 100% 초과**할 때 경고하며 설정이 `BLOCK`이면 기존 트리거가 저장을 거절한다. `public.resource_leave_windows`는 승인된 기존 휴가의 날짜와 유형만 타임라인에 표시하며 사유는 조회하지 않는다.

계획 진행률은 계획 시작일과 종료일을 포함한 경과 일수 비율(0~100%), 실제 진행률은 PM이 입력한 값이 있으면 그 값, 없으면 하위 WBS 업무 진행률의 단순 평균이다. 계획보다 실제가 15%p 이상 낮으면 일정 확인 안내를 보여준다. 완료되지 않은 프로젝트의 계획 종료일이 지난 경우 목록과 상세에 `일정 지연` 배지를 표시한다. 사이드바의 프로젝트 관리 그룹은 `프로젝트 대시보드`, `리소스 계획` 두 경로를 유지한다.

새 마이그레이션은 로컬 Supabase에 적용해 검증했다. 배포 DB에는 배포 절차에 따라 마이그레이션을 적용해야 새 화면을 사용할 수 있다.

Phase 5~6 구현이 완료되었다. 물리 스키마는 `20260913115628_phase5_project_resource.sql`과 `20260913121204_phase6_reporting_security.sql`, 화면은 `/projects`, `/admin/projects`, `/admin/projects/[id]`, `/admin/resources`, `/admin/settings`가 기준이다.

Project는 코드·이름·고객·설명·예정/실제 시작/종료·PM·상태를 소유한다. PLANNING/SCHEDULED/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELED로 관리한다. 배정은 별도 ProjectAssignment이며 사용자·역할·예정/실제 기간·allocation_rate·메모와 PLANNED/CONFIRMED/IN_PROGRESS/ON_HOLD/ENDED/CANCELED 상태를 가진다.

한 직원의 복수 프로젝트 배정을 허용한다. allocation_rate는 0..100 numeric(5,2). 화면의 시작·종료 날짜는 양끝 포함이고 내부 계산은 종료일+1의 half-open interval이다. 실제 기간은 현재 실적, 예정 기간은 미래 계획에 사용한다. CANCELED와 해당 구간 밖의 ENDED는 합산에서 제외한다. ON_HOLD의 투입률은 초기 정책에서 0으로 계산하고, 예약인력 유지 정책이 필요하면 별도 설정으로 확장한다.

겹치는 날짜마다 투입률 합계를 계산한다. 50%+50%는 정상, 60%+50%가 겹치는 기간은 110% 경고다. 기본 WARN은 저장을 허용하고 peak allocation을 응답한다. BLOCK 설정에서는 BEFORE trigger가 같은 transaction에서 100% 초과를 거부한다.

리소스 Dashboard에는 직원·조직·직급·현재/다음 프로젝트·투입기간·현재/예정 투입률을 표시한다. 현재 0% 대기, 미래 시작 투입예정, 현재 >0% 투입중, lookahead 내 종료 철수예정, >100% 초과, 프로젝트 종료예정 flags를 개별 표현한다. 조회 기준일과 lookahead를 표시하여 추정 기간이 불명확한 통계를 제공하지 않는다.

PM은 실제 project_manager_id가 본인인 프로젝트와 참여자 업무 정보를 관리한다. HR/Admin 전사 조회는 별도 permission이다. PM 변경은 전사 관리 권한을 요구한다. 배정·철수·일정 변경은 audit와 알림을 같은 transaction에 저장하며 과거 배정을 삭제하지 않는다.

종료 테스트: 프로젝트 상태·배정·철수, 기간 합산 경계, WARN/BLOCK 및 동시 배정, 취소/보류 제외, PM scope, 직원 본인 조회, 알림/audit 및 lint/typecheck/test/build.

## Phase 11 인력 수요 확장

기존 `ProjectAssignment`와 `resource_capacity()`를 변경 없이 실제 투입 및 가용률의 Source of Truth로 사용한다. 프로젝트 상세의 `인력 계획`은 `project_staffing_requirements`에 역할·인원·기간·투입률을, 연결 테이블에 필수/우대 Skill을 기록한다. 후보 검색은 같은 기간의 기존 Capacity core에서 최저 가용률을 계산하고 조직·직급·Skill·경력 필터와 필수 Skill 일치 수를 제공한다. 최종 배정은 기존 투입 인력 보드에서 수행하고 `project_staffing_fulfillments`로 요구사항과 실제 Assignment를 연결한다.

프로젝트 대시보드 목록은 DB 집계 RPC의 필요/충원 인원과 Open Issue를 추가 표시한다. PM은 자신이 담당하는 프로젝트의 Staffing 최소정보만 조회하며 전체 직원 인력프로필 권한은 받지 않는다. 상세 스키마·권한·검증은 `docs/deliverables/2026-09-20/phase11-workforce-profile/`에 있다.
