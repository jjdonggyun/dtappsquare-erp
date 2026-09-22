# Phase 7 — 직원 업무관리

## 기존 ERP와의 관계

`modules/work-management`는 Employee 중심의 독립 모듈이다. 프로젝트 배정은 주간보고 대상 조건이 아니며 `daily_work_logs.project_id`와 `project_task_id`는 선택적 참조다. `PROJECT` 구분에서만 프로젝트를 필수로 받으며 WBS 업무는 선택 사항이다. 프로젝트 상세의 `업무 기록` 탭은 연결된 일지만 RLS 범위에서 조회한다. 근태 이벤트나 출근 판정을 업무일지로 생성·변경하지 않는다.

## 저장 모델과 명령

- `daily_work_logs`: 직원, 업무일, 구분, 프로젝트/WBS 참조, 제목·내용, 선택적 시작·종료시각, 작업 분, 진행률, 상태·막힌 점·메모, soft delete, version, 감사 시각. 같은 날짜에 여러 건을 허용한다.
- `weekly_reports`: 직원 + 월요일 `week_start_date` unique, 금요일 종료일, 직원이 수정하는 요약·완료·진행·이슈·다음 주 계획, `entries_snapshot`, `DRAFT → CONFIRMED`, 확정시각, version. 생성 시 업무일지를 한 번 집계하고 확정본은 재집계·수정하지 않는다.
- `work_management_command`: `work_log.save/delete`, `weekly_report.generate/refresh/save/confirm`. 클라이언트에서 직원 ID를 전달받지 않고 `auth.uid()`를 사용한다. 변경 시 기대 version을 비교한다.
- `weekly_report_roster`: ACTIVE 직원 전체를 조직 범위로 제한하고 보고 상태 및 승인된 전일 휴가 일수를 반환한다. 5일 전일 휴가인 직원은 UI의 단순 미작성 집계에서 제외한다. 공휴일 원천 테이블은 아직 없으므로 공휴일 제외는 후속 정책 과제다.
- `work_log_daily_status`: 대시보드용 기간일 직원별 작성 건수·시간 합계를 DB에서 계산한다.

## 권한과 화면

`WORK_LOG_READ_SELF/WRITE_SELF/READ_TEAM/READ_ALL/READ_PROJECT`, `WEEKLY_REPORT_READ_SELF/WRITE_SELF/READ_TEAM/READ_ALL`을 기존 Permission Catalog에 추가했다. TEAM_MANAGER 범위는 이름이나 역할만으로 결정하지 않고 `organizations.leader_user_id`에 기반한 기존 `private.manages_organization()`을 쓴다. PM의 업무일지 조회는 자신이 관리하는 프로젝트 연결 건에 한한다. 테이블 직접 쓰기는 거부하고 읽기는 RLS를 적용한다.

`/work-logs`에서 빠른 입력, 날짜 이동, 어제 업무 불러오기, 이전 업무 복사, 수정·삭제, 일일 총 시간을 제공한다. 프로젝트 선택 시 조회 가능한 프로젝트와 WBS를 보여준다. `/weekly-reports`는 팀/전사 범위의 대상·확정·작성 중·미작성 현황, 본인 초안 편집·확정을 제공한다. `/presentation/weekly-reports`는 별도 최소 레이아웃에서 주차·팀·직원 이동과 키보드 좌우 이동을 지원한다.

## 검증

로컬 Supabase 통합 테스트는 Project NULL 허용, 본인 작성, 타인 변경 거부, 팀장과 타팀 경계, 프로젝트 연결, version 충돌, ACTIVE 직원 roster, 확정 이후 업무일지 변경 시 스냅샷 불변을 확인한다. 업무일지 미작성과 출근/결근은 서로 별개 지표다.
