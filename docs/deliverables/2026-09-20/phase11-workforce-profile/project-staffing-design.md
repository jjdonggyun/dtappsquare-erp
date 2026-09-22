# 프로젝트 인력 계획 설계

`project_staffing_requirements`는 필요 역할·인원·기간·투입률·상태를, `project_staffing_requirement_skills`는 필수/우대 기술·기준 수준을 보유한다. 하나의 실제 `project_assignments`는 최대 한 활성 요구사항에 연결된다. `project_staffing_fulfillments`에서 상태·기간이 유효한 배정의 직원 수를 세어 OPEN/PARTIALLY_FILLED/FILLED/CLOSED를 표시한다. 수요와 실제 배정은 별개이므로 인력 계획이 프로젝트 투입 데이터를 자동 변경하지 않는다.

후보 검색은 요구사항 기간의 **최저 가용률**을 기존 `private.resource_capacity_core`에서 읽는다. 조직·직급·기술·최소 경력·최소 가용률을 필터링하고 필수 기술 일치 개수/총개수, 기술 목록을 반환한다. Skill Level의 순서는 요구 기준 일치 판정에만 사용하며 직원 평가·자동 추천 순위로 사용하지 않는다. 동일 가용률이면 이름 순으로 표시한다.

PM은 자신이 담당하는 프로젝트의 최소 후보 정보만 받는다. 전체 프로필은 기존 직원별 권한 검사 후 별도 화면에서 열며, 후보 응답의 직원별 `can_read_profile`이 참일 때만 링크를 표시한다. 실제 배정은 기존 투입 인력 보드에서 하고 요구사항과 Assignment를 연결한다. 포트폴리오 목록은 별도 집계 RPC에서 필요/충원 인원과 Open Issue를 받아 표시한다.

후속 고려: 프로젝트 종료 시 아직 작성되지 않은 내부 경력 서술을 직원에게 안내하는 알림. 현재는 자동 서술/확정하지 않는다.
