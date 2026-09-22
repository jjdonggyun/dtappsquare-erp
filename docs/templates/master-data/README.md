# Phase 12 실데이터 입력용 Canonical CSV

이 폴더의 CSV는 **헤더만 있는 빈 양식**입니다. 실제 직원 데이터를 이 저장소의 예제 파일에 직접 저장하거나 Git에 올리지 마세요. 별도의 접근 제한된 복사본에 입력한 뒤 검증합니다. UTF-8 CSV, 첫 행 헤더 유지, 날짜 `YYYY-MM-DD`, 시각 `HH:MM`, 참/거짓 `true`/`false`를 사용합니다. 쉼표가 든 값은 CSV 따옴표로 감싸고 내부 따옴표는 두 번 씁니다. 전화·이메일 등 개인정보는 검증 결과에도 원문을 출력하지 않습니다.

UUID는 적지 않습니다. 사번, 조직 코드, 자산 코드, 프로젝트 코드, 근무정책 코드로 관계를 연결합니다. 검증기는 **동일 묶음의 CSV 간 참조**를 확인합니다. 기존 운영 DB와의 중복·변경 충돌 및 Auth 계정 생성은 Phase 12의 실제 Import 직전 별도로 검증합니다. `organizations.code`는 Phase 10에서 nullable로 추가했으므로 기존 조직 UUID를 유지할 수 있습니다. 기존 조직에 코드가 없다면 관리자가 먼저 대응표를 확정해야 합니다.

## 파일별 컬럼

`필수`는 각 행에서 비우면 오류입니다. 표에 없는 선택 컬럼은 비울 수 있습니다. 모든 헤더는 양식과 정확히 일치해야 합니다.

| 파일 | 필수 컬럼 | 선택 컬럼과 규칙 | 참조/예시 |
|---|---|---|---|
| `organizations.csv` | `organization_code`, `organization_name`, `type`, `active` | `parent_code`, `leader_employee_number` | `DS`, `Digital Square`, `COMPANY`, `true`; 부모는 같은 파일의 코드, 리더는 `employees.employee_number` |
| `positions.csv` | `position_code`, `position_name`, `sort_order`, `active` | 없음 | `SENIOR`, `선임`, `10`, `true` |
| `titles.csv` | `title_code`, `title_name`, `sort_order`, `active` | 없음 | `DEVELOPER`, `개발자`, `10`, `true` |
| `employees.csv` | `employee_number`, `name`, `email`, `join_date`, `organization_code`, `employment_type`, `status` | `phone`, `resignation_date`, `position_code`, `title_code`; `RESIGNED`는 퇴사일 필수 | `E001`, `hong@example.com`, `2026-01-01`, `DS`; 조직/직급/직책 코드 참조 |
| `roles.csv` | `role_code`, `role_name`, `active` | 없음 | 회사 고유 Role만 기입. 기존 시스템 Role은 다시 만들지 않음 |
| `employee_roles.csv` | `employee_number`, `role_code` | 없음 | 직원 사번과 기존 시스템 Role 또는 `roles.csv` 코드 |
| `work_policies.csv` | `work_policy_code`, `work_policy_name`, `check_in_time`, `check_out_time`, `late_grace_minutes`, `timezone`, `working_days` | `break_start`, `break_end`는 함께 입력 | `STANDARD`, `09:00`, `18:00`, `5`, `Asia/Seoul`, `"1,2,3,4,5"` (ISO 월~금) |
| `work_policy_assignments.csv` | `employee_number`, `work_policy_code`, `effective_from` | `effective_to`는 미포함 종료일 | `E001`, `STANDARD`, `2026-10-01`; 사번·정책 코드 참조 |
| `assets.csv` | `asset_code`, `asset_type`, `status` | `manufacturer`, `model`, `serial_number`, `purchase_date`, `warranty_end_date` | `DT-LAPTOP-001`, `LAPTOP`, `ASSIGNED` |
| `asset_assignments.csv` | `asset_code`, `employee_number`, `assigned_at` | `memo`; 사용 중 자산당 열린 지급 1건 | `DT-LAPTOP-001`, `E001`, `2026-10-01T09:00:00+09:00` |
| `projects.csv` | `project_code`, `project_name`, `customer_name`, `pm_employee_number`, `planned_start_date`, `planned_end_date`, `status` | `description` | `DS-PJT-001`, `고객 프로젝트`, `고객사`, `E001`, `2026-10-01`, `2026-12-31`, `IN_PROGRESS` |
| `project_assignments.csv` | `project_code`, `employee_number`, `role`, `planned_start_date`, `planned_end_date`, `allocation_rate`, `status` | `memo`; 투입률 0~100, 소수 둘째 자리까지 | `DS-PJT-001`, `E001`, `Developer`, `2026-10-01`, `2026-12-31`, `50`, `IN_PROGRESS` |
| `attendance_networks.csv` | `network_name`, `cidr`, `active` | 없음 | `Office`, `203.0.113.10/32`, `true`; **예시 주소는 실제 회사 IP가 아님** |
| `workforce_profiles.csv` | `employee_number`, `profile_status` | 생년월일, 경력 기준일, 보정 개월수·사유, 요약 | 직원 마스터와 1:1. 보정 개월수에는 사유 필수 |
| `workforce_educations.csv` | `employee_number`, `school_name`, `graduation_status`, `highest_education` | 학위, 전공, 기간, 순서 | 직원당 활성 최종학력 1개 |
| `skills.csv` | `skill_code`, `skill_name`, `category`, `active` | 없음 | 코드로 기술 참조; category는 회사 분류명 |
| `employee_skills.csv` | `employee_number`, `skill_code` | 수준, 경력연수, 최근 사용일, 메모 | 직원·기술 조합 고유 |
| `workforce_certifications.csv` | `employee_number`, `certification_name` | 발급기관, 취득·만료일, 증명번호 | Skill과 분리된 자격 이력 |
| `workforce_project_experiences.csv` | `employee_number`, `source_type`, `responsibilities` | `MANUAL_HISTORY`: 프로젝트명·시작일·역할 필수. `INTERNAL_PROJECT`: 프로젝트 코드·투입 시작일 필수 | 내부 프로젝트명·기간·역할은 기존 투입 데이터에서 읽음 |
| `project_staffing_requirements.csv` | `requirement_key`, `project_code`, `role_name`, `required_headcount`, 계획 시작·종료일, `allocation_rate`, `lifecycle_status` | 설명 | `requirement_key`는 Import 묶음 연결용, DB에는 저장하지 않음 |
| `project_staffing_skills.csv` | `requirement_key`, `skill_code`, `preference` | 요구 수준 | 필요·우대 기술 연결 |

DB enum은 현재 migration의 제약과 동일합니다. 조직 유형 `COMPANY/DIVISION/TEAM/DEPARTMENT`, 고용형태 `FULL_TIME/CONTRACT/PART_TIME/INTERN`, 직원 상태 `REQUESTED/ACTIVE/SUSPENDED/RESIGNED`, 자산 유형 `LAPTOP/DESKTOP/MONITOR/PHONE/TABLET/LICENSE/ETC`, 프로젝트 상태 `PLANNING/SCHEDULED/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELED`, 투입 상태 `PLANNED/CONFIRMED/IN_PROGRESS/ON_HOLD/ENDED/CANCELED`입니다. 휴가/결재/근태 이벤트와 자산 기기 토큰은 이 마스터데이터 양식에 포함하지 않습니다.

## Dry Run

```powershell
npm run import:master-data
npm run import:master-data -- C:\secure\master-data
```

기존 직원 인력프로필 `.xlsx`는 별도 읽기 전용 검증기로 확인합니다. 첨부 양식의 B2/D2/F2(성명·생년월일·업무경력), B3/D3/F3(소속·최종학교·전공), B4(기술), B~E열 프로젝트 경력을 읽습니다. 검증 결과에는 이름·생년월일·업무 내용을 출력하지 않습니다. 월 단위 경력 기간은 정확한 일자를 추정할 수 없으므로 Phase 12 입력 전 확인합니다.

```powershell
npm run import:workforce-profile -- C:\secure\profiles.xlsx --dry-run
```

두 명령 모두 DB 쓰기를 지원하지 않습니다. 실제 직원 파일은 이 저장소에 추가하지 마세요.

명령은 `Total`, `Valid`, `Warnings`, `Errors`와 파일·행·컬럼별 결과를 출력합니다. 오류가 하나라도 있으면 종료 코드 1입니다. 중복 업무키·없는 참조·날짜/enum·조직 순환·자산 중복 지급은 오류, 직원의 기간별 프로젝트 투입률 100% 초과는 경고입니다. **현재 명령은 DB에 쓰지 않습니다.** Phase 12에서 실제 데이터 검토와 사용자 확인을 거친 뒤 기존 RPC/RLS 정책에 맞는 Import 적용 경로를 추가합니다.

## 입력 순서와 확인

1. 조직·직급·직책·근무정책, 직원/Role, 자산·프로젝트, 배정/투입 순으로 작성합니다. 조직 리더 사번은 직원 CSV를 모두 작성한 뒤 검증합니다.
2. 동일 묶음 Dry Run의 오류를 모두 고칩니다. 투입률 경고는 기존 `resource_capacity()` 정책과 대조해 팀장/PM이 검토합니다.
3. Phase 12에서 운영 DB 기존 코드/이메일/serial과 대조하고, 등록 직원의 Auth identity 생성 및 역할 부여 순서를 확인합니다. 이미 있는 직원/조직은 무작정 재생성하지 않습니다.
4. 실제 Import 전 백업, Preview 적용, 관리자 최종 확인을 거칩니다. Device Agent 토큰과 실제 회사 공인 IP는 별도 보안 채널에서 설정합니다.
