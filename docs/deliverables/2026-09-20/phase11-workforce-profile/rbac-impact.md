# RBAC · 개인정보 영향

| 대상 | 권한 | 실제 범위 |
|---|---|---|
| 본인 | READ_SELF / WRITE_SELF / EXPORT_SELF | 본인 전문정보, 생년월일·경력 보정 쓰기 제외 |
| TEAM_MANAGER | READ_TEAM / EXPORT_TEAM | `organizations.leader_user_id`가 가리키는 실제 관리 조직·하위 조직 |
| HR_MANAGER / ADMIN | READ_ALL / MANAGE / EXPORT_ALL | 전사 프로필, 제한 필드 관리 |
| PROJECT_MANAGER | STAFFING_READ / PROJECT_STAFFING_READ/MANAGE | 담당 프로젝트 후보의 최소 기술·가용률, 수요 관리; 전체 프로필 권한 없음 |

프로필을 아직 작성하지 않은 직원도 `workforce_profile_access`로 scope를 먼저 판정한다. 모든 프로필 하위 테이블은 동일 RLS helper를 사용한다. `workforce_profile_projects`는 프로필 접근 범위 안에서만 기존 프로젝트 투입을 읽는다. 직접 DML은 revoke하고 쓰기는 ACTIVE/Permission/Scope/Version/멱등성을 확인하는 RPC만 허용한다.

Excel Export는 최대 20명을 한 요청으로 처리한다. 대상마다 권한을 DB에서 재검사하고 기존 `audit_logs`에 actor·target·timestamp·생년월일 포함 여부를 저장한다. 일반 Export 기본값에서 생년월일은 제외된다. Audit trigger는 생년월일과 자격 credential ID 값을 기록하지 않는다. PM 후보 응답에는 생년월일·이메일·학력·서술 전문을 포함하지 않는다.
