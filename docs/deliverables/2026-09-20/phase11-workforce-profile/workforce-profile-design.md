# 인력프로필 설계

`employees`는 이름·조직·직급·이메일의 Source of Truth다. `workforce_profiles`는 경력 시작일·서술·상태·제한 생년월일 및 기존 Excel 경력 보정 개월수/사유만 보유한다. 경력 표시는 시작일에서 지난 완전한 개월을 계산하고, 문서화된 override가 있으면 이를 우선한다. Excel의 단순 `3년` 텍스트는 Source of Truth가 아니다.

학력은 이력 행으로 저장하고 직원당 활성 최종학력 1개를 DB unique index로 강제한다. 기술은 `skills` 카탈로그와 `employee_skills` 조인, 자격은 별도 `workforce_certifications`로 관리한다. 현재/예정 프로젝트는 `workforce_profile_projects`가 기존 ProjectAssignment/Project에서 제한 범위로 읽는다.

프로젝트 수행경력의 `MANUAL_HISTORY`는 과거 프로젝트명·기간·역할을 저장한다. `INTERNAL_PROJECT`는 동일 직원의 ProjectAssignment를 복합 FK로 참조하며 프로젝트명·고객사·기간·역할 복사를 CHECK로 금지한다. 직원별 `responsibilities`와 `technologies`만 별도 서술한다. 화면은 최신 시작일 순으로 표시한다. 프로젝트 종료 후 기존 투입을 선택해 서술을 확인하고 저장할 수 있지만 자동 확정/AI 작성은 하지 않는다.

본인은 전문 정보와 프로젝트 주요 업무를 수정한다. 생년월일과 legacy 경력 보정은 관리 권한자만 변경한다. 버전 충돌은 409로 처리하고 변경은 기존 Audit에 남긴다. 삭제는 대체로 `active=false`로 프로필 표시만 해제하여 이력을 보존한다.
