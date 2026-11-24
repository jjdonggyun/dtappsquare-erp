# ERP 권한 및 Dashboard 재설계

## 현행 분석 (2026-10-07)

| 영역 | 현재 구현 | 문제 / 재사용 방향 |
|---|---|---|
| 사용자 | `employees`에 조직, 직급, 입사일, `REQUESTED/ACTIVE` 상태 | 가입은 이미 대기 상태. 승인 시 역할 선택을 원자적으로 처리해야 함 |
| 역할 / 권한 | `roles`, `permissions`, `role_permissions`, `user_roles`; 서버 `account_context()` | 역할 상속과 사용자별 허용/거부 없음. `ADMIN`, `TEAM_MANAGER`, `EMPLOYEE` 등 기술 역할을 업무 역할로 이행 |
| 조직 | `organizations` 트리, `leader_user_id` | 팀장 권한은 실제 담당 조직과 하위 조직으로 제한 |
| 프로젝트 | `projects.project_manager_id`, `project_assignments` | PM/배정 기준 RLS 존재. 팀원 참여 프로젝트 범위를 추가 |
| 가입 | Auth 트리거가 `REQUESTED` 생성; `employee.status`가 승인 | 승인 권한의 조직 범위와 역할 지정 필요 |
| 휴가 / 승인 | `leave_requests`, `approval_subjects`, `approval_requests`, `approval_request_steps`, `approval_routing_policies` | 공통 승인 모델 재사용. 휴가 경로를 팀장→관리직으로 명시하고 Head 우회 기록 |
| Navigation | 권한별 `visibleNavigation()` | 유지하고 대시보드 구성도 같은 유효 권한을 사용 |
| Dashboard | 하나의 큰 페이지에서 직원/근태/프로젝트 자료를 모두 읽음 | 역할별 쿼리와 위젯 분리. 민감 KPI는 별도 권한 검사 |
| API / RLS | API 서비스의 `authorize`, DB `private.require_permission`와 RLS | 화면 게이트를 보조로 쓰고 DB 범위 검사를 정본으로 유지 |
| Audit | `audit_logs` 트리거 | 권한/승인/바이패스 사유를 명시적으로 보존 |

## 설계

### Role 및 Permission Matrix

기본 업무 역할은 `GUEST`, `MEMBER`, `TEAM_LEADER`, `ADMINISTRATIVE_POSITION`, `HEAD`다. `MEMBER`는 `GUEST`를, `TEAM_LEADER`는 `MEMBER`를, `ADMINISTRATIVE_POSITION`은 `TEAM_LEADER`를 상속한다. `HEAD`는 별도 정책 역할이며 회사 전체 읽기와 승인 우회를 가진다. 기존 기술 역할은 호환을 위해 유지하지만 신규 발급은 업무 역할을 기본으로 한다. 권한 변경은 역할의 직접 권한과 사용자별 허용/거부를 합성하며, 거부가 우선한다.

| 능력 | Guest | Member | Team Leader | Administrative Position | Head |
|---|---|---|---|---|---|
| 프로필 | 제한된 본인 | 본인 | 본인 | 본인 + 전 직원 | 본인 + 전 직원 |
| 프로젝트 | 없음 | 배정 | 배정 + PM + 관리 팀원 참여 | 전체 | 전체 |
| 업무/공수 | 없음 | 본인 | 팀/담당 프로젝트 | 전체 운영 | 전체 조회/운영 |
| 근태/휴가 | 없음 | 본인 신청 | 팀 조회/1차 승인 | 전체 조회/최종 승인 | 전체 조회 + 자기 신청 자동 승인 |
| 가입 승인 | 없음 | 없음 | 자기 팀으로 가입 승인 | 전체 | 전체 |
| 영업/청구/재무 | 없음 | 없음 | 명시적 권한만 | 기본 부여 | 전체 |
| 손익/인건비 | 없음 | 없음 | 명시적 권한만 | 손익 기본, 인건비 별도 | 전체 |
| 역할/설정 | 없음 | 없음 | 없음 | 명시적 권한만 | 전체 |

구체 권한은 기존 코드(`PROJECT_READ_SELF`, `PROJECT_READ_ALL`, `LEAVE_APPROVE`, `LEAVE_MANAGE` 등)를 유지하고 `LEAVE_TEAM_APPROVE`, `LEAVE_FINAL_APPROVE`, `PROJECT_BASIC_FINANCE_READ`, `EMPLOYEE_COST_READ`, `APPROVAL_BYPASS`를 확장한다. 상속은 역할 그래프를 통해 계산하며 문자열 크기 비교를 하지 않는다.

### Data Scope

`SELF`, `TEAM`, `ASSIGNED_PROJECT`, `DEPARTMENT`, `ALL`을 권한별 범위로 저장한다. 상위 범위는 무조건 문자열 순위로 대체하지 않는다. 예를 들어 프로젝트의 `TEAM`과 `ASSIGNED_PROJECT`는 합집합이다. 유효 권한이 있어도 해당 범위의 리소스 판정이 실패하면 읽기/쓰기 모두 거부한다. 팀 범위는 `organizations.leader_user_id`와 조직 트리, 프로젝트 범위는 `project_assignments`와 PM으로 판정한다. 금융 컬럼/테이블은 프로젝트 읽기와 별도 RLS/권한으로 제어한다.

### Approval Matrix

| 요청자 | 휴가 결재 | 정책 예외 |
|---|---|---|
| Member | 소속 Team Leader → Administrative Position | 누락된 결재자는 무단 대체하지 않고 경로 오류 |
| Team Leader | Administrative Position | 관리직이 없으면 정책에 따라 Head |
| Administrative Position | Head | 정책에서 Head 승인 요구를 조정 가능 |
| Head | 자동 승인 | `HEAD_BYPASS`/`AUTO_APPROVED_BY_POLICY` 감사 기록 |

`approval_subjects`/`approval_requests`/`approval_request_steps`를 공통 엔진으로 재사용한다. 견적·계약은 이미 이 모델을 사용한다. 모든 반려는 현재 단계 결재자, 시간, 사유를 저장한다. 신규 업무는 `request_type`별 정책/스텝 생성기를 추가한다.

### Dashboard 및 Navigation

Head: 회사 재무·영업·프로젝트 손익·미수·가동률·경보. Administrative Position: 영업·인사/근태·재무·청구/수금 및 처리 대기. Team Leader: 팀과 담당 프로젝트·주간보고·휴가/가입 승인. Member: 내 프로젝트·업무·근태·휴가·비용. Guest/가입 대기: 제한 안내. 위젯과 메뉴는 실제 유효 Permission을 검사하고, 같은 역할이라도 사용자별 제한을 반영한다. 서버에서 필요한 쿼리만 실행한다.

### Schema 및 Migration

1. 업무 역할과 상속 관계, 권한별 기본 범위, 사용자별 권한 예외를 추가한다.
2. 기존 사용자 역할은 매핑하되 기존 권한을 갑자기 제거하지 않는다. `EMPLOYEE`→`MEMBER`, `TEAM_MANAGER`→`TEAM_LEADER`, `HR_MANAGER`/`ADMIN`은 담당자 검토 후 이행한다. `ADMIN` 자동 변환은 과도한 권한을 만들 수 있으므로 보류한다.
3. `account_context`와 DB 권한 함수를 유효 권한 계산으로 전환한다. 사용자별 거부가 기존 역할 권한에도 적용된다.
4. 프로젝트 및 가입 승인 RLS/명령을 범위에 맞춰 강화한다. 휴가 경로는 기존 결재 자료를 유지하고 신규 요청에 새 규칙을 적용한다.
5. 기존 감사 로그와 승인 기록은 보존한다. 스키마 적용 전 백업, 적용 후 역할별 읽기/쓰기/결재 회귀 확인이 필요하다.

## 구현 및 검증 상태 (2026-10-07)

- 업무 역할, 상속, Permission별 Data Scope, 사용자별 허용/거부, 유효 권한 계산을 migration으로 추가했다. 기존 `EMPLOYEE`/`TEAM_MANAGER` 보유자에게 `MEMBER`/`TEAM_LEADER`를 병행 부여하고 기존 기술 역할은 보존한다.
- 가입 승인 명령은 조직 범위와 지정 역할을 한 트랜잭션에서 검사한다. 팀장은 자신이 관리하는 팀의 Member만 승인할 수 있다. 관리직은 회사 범위에서 Team Leader/관리직도 승인할 수 있고 Head 지정은 RBAC 권한을 요구한다.
- 직원, 가입 대기자, 프로젝트, 프로젝트 비용의 DB 읽기 범위를 보강했다. Guest는 프로필 중심으로 제한한다. 화면 메뉴, 직접 URL, 명령 RPC 각각 유효 권한을 확인한다.
- 휴가는 Member → Team Leader → Administrative Position, Team Leader → Administrative Position, Administrative Position → Head 경로를 생성한다. Head의 휴가·비용·견적·계약 제출은 자동 승인하고 `HEAD_BYPASS` 감사 기록을 남긴다. 공통 승인 단계의 반려에는 사유와 반려 시각을 강제한다.
- 역할별 대시보드와 권한별 위젯/메뉴를 적용했다. 회사 KPI는 별도 DB 집계 RPC에서 권한별로 계산한다. 사용자 상세 화면에서 승인 역할 및 개별 Permission 예외를 설정할 수 있다.
- 모든 신규 migration을 로컬 DB에 적용하고 역할·범위·Head 자동 승인에 관한 트랜잭션 통합 테스트를 실행했다. 프로덕션 DB 적용은 별도 배포 절차가 필요하다.

### 이행 및 확장 시 유의사항

- 기존 `ADMIN`, `HR_MANAGER` 등의 기술 역할은 자동 제거하지 않았다. 이 역할의 권한은 신규 업무 역할과 합쳐지므로 운영 데이터에서 실제 담당자를 검토한 뒤 수동 전환해야 한다.
- Data Scope는 현재 핵심 프로젝트·직원·가입 승인·비용 경계부터 적용했다. 기존 다른 업무 테이블은 종전 Permission/RLS 규칙을 유지하며, 조직 범위 세분화가 필요한 업무마다 같은 Scope 판정을 확장해야 한다.
- 비용 승인은 기존 비용 상태 모델을 유지한다. 공통 `approval_requests`/`approval_request_steps`는 휴가·견적·계약에 적용되어 있으며, 향후 비용·프로젝트 마감·구매를 이 엔진으로 옮길 수 있다.
- 기존 결재 요청의 `route_snapshot`은 변경하지 않는다. 새 경로와 Head 정책은 신규 제출에 적용한다.
