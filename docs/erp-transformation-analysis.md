# Digital Square ERP 통합 확장 분석 및 구현 청사진

작성일: 2026-09-26  
분석 대상: 현재 저장소, 생성된 Supabase 타입, 전체 마이그레이션, 로컬 Supabase 실제 스키마/데이터, App Router 페이지와 Route Handler

## 0. 결론

현재 시스템은 다시 만들 대상이 아니다. 인증, 직원/조직, Permission 기반 RBAC, 근태/휴가, 범용 결재 기반, 프로젝트/투입, 업무일지/주간보고, 법인카드 비용, 알림 Outbox, 감사 로그가 이미 실제 DB와 연결되어 있다. 이 기반 위에 고객사와 영업·계약·청구·수금 도메인을 증분 추가하고, 기존 `projects.customer_name` 문자열을 정식 고객사 FK로 점진 전환하는 것이 가장 안전하다.

핵심 결정은 다음과 같다.

- 기존 52개 업무 테이블과 기존 URL을 삭제하거나 재생성하지 않는다.
- `employees`, `projects`, `project_assignments`, `daily_work_logs`, `weekly_reports`, `expenses`, `approval_*`, `notifications`, `audit_logs`를 Source of Truth로 재사용한다.
- 고객사 → 영업기회 → 견적 Revision → 승인 → 계약 → 프로젝트 → 검수 → 청구 → 세금계산서 → 입금의 연결만 새로 만든다.
- 재무 합계는 UI state가 아니라 PostgreSQL 함수/RPC와 공통 서버 도메인 로직에서 `numeric`으로 계산한다.
- 새 메뉴는 도메인/업무 흐름 기준으로 재구성하되, 노출 여부는 Role 이름이 아니라 기존 Permission 집합으로 결정한다.
- 프로젝트 상세와 고객사 상세를 업무 허브로 만들고, 탭은 가능한 한 URL을 갖는 하위 경로로 구성한다.
- 구현은 forward-only migration과 expand → backfill → dual-read → switch → contract 순서로 진행한다.

## 1. 조사 범위와 현재 실행 상태

### 기술 스택

- Next.js 16.3.4 App Router, React 19.2.8, TypeScript 6 strict
- Tailwind CSS 4, Radix 기반 로컬 UI 컴포넌트, lucide-react
- Supabase SSR 0.12.6, supabase-js 2.115, PostgreSQL/Supabase Local
- Zod 입력 검증, ExcelJS, Nodemailer, Vitest
- Route Handler → application command → repository → PostgreSQL RPC의 모듈형 모놀리스

Next.js 16 로컬 문서를 기준으로 확인했다. App Router의 Route Handler는 공개 API와 동일한 보안 경계로 취급해야 하며, 인증/권한은 레이아웃 표시 제어에만 의존하지 않고 데이터 접근 계층과 각 mutation에서 재검증해야 한다. 현재 `currentAccount`/`requirePage`와 DB RLS/RPC의 이중 통제는 이 원칙과 부합한다.

### 로컬 DB 확인 결과

- PostgreSQL 17.6
- public 업무 테이블 52개, 모든 public 업무 테이블에 RLS 활성화
- 실제 데이터 존재: 직원 6, 조직 10, 프로젝트 2, 프로젝트 투입 2, 비용 4, 휴가 신청 5, 알림 18, 감사 로그 519 등
- 역할 7개, Permission 62개, Role-Permission 연결 159개
- private Storage: `expense-receipts`, `card-settlements`
- DB lint warning 이상 없음
- 적용 migration 31개
- 저장소에만 있고 DB에는 미적용인 migration 1개: `20260923035647_fix_attendance_dev_lan_and_status.sql`

따라서 이후 migration 전에 위 미적용 migration을 먼저 검증·적용해야 한다. 이 분석에서는 DB를 reset하거나 데이터를 변경하지 않았다.

### Supabase/PostgreSQL 업데이트 사전 점검

현재 설치 extension은 `btree_gist`, `pgcrypto`, `pg_stat_statements`, `supabase_vault`, `uuid-ossp` 등이다. 최신 Postgres 패치의 관련 호환성 항목을 점검한 결과:

- `ltree`는 설치되어 있지 않다.
- `btree_gist` 기반 인덱스 3개는 UUID와 date range에 사용되며 float/NaN opclass를 사용하지 않는다.
- `pgcrypto` 호출은 SHA-256 `digest`에 한정되며 legacy cipher 호출은 없다.
- public/private 사용자 정의 operator는 없다.

현재 확인 범위에서는 알려진 해당 호환성 항목에 직접 걸리지 않지만, 운영 DB 업그레이드 전에는 같은 SQL 점검을 다시 수행한다.

## 2. 기존 Navigation 구조

현재 사이드바는 `src/components/layout/workspace-shell.tsx`에 8개 그룹이 하드코딩되어 있고, 실제 메뉴 정의는 `src/modules/rbac/domain/policy.ts`에 별도로 있다.

1. 내 워크스페이스
2. 업무관리
3. 조직 · 인사
4. 근태 · 결재
5. 자산 · 장치
6. 프로젝트 관리
7. 법인카드 · 비용
8. 시스템

장점은 Permission 기반 필터가 이미 적용된 점이다. 문제는 다음과 같다.

- 메뉴 정의, 그룹 정의, 아이콘 정의가 서로 다른 구조로 분산되어 있다.
- 개발된 기능 순서와 관리자/일반 사용자 구분이 메뉴 구조에 섞여 있다.
- `/admin/*`가 업무 도메인 URL로 사용되어 PM·재무 담당자에게도 관리자 기능처럼 보인다.
- 상단 Breadcrumb의 첫 항목이 항상 `업무관리`로 고정되고 상세 엔티티 계층을 표현하지 못한다.
- 고객/영업/계약/재무 수금 축을 수용할 자리가 없다.

## 3. 기존 Dashboard 구조

`src/app/(workspace)/dashboard/page.tsx` 하나에서 직원·근태·휴가·결재·자산·프로젝트·업무일지·주간보고·법인카드 데이터를 병렬 조회한다. `USER_READ` 보유 여부를 사실상 admin 분기로 사용하고 팀/일반 사용자는 일부 카드만 달라진다.

재사용할 부분:

- 서버 컴포넌트에서 Permission과 조직 scope를 반영한 데이터 조회
- 공통 Metric Card와 현재 근태/업무/프로젝트 KPI
- DB 함수 기반 집계(`work_log_daily_status`, `weekly_report_roster`, `card_month_amount`)

개선할 부분:

- `USER_READ` 하나로 관리자 Dashboard를 결정하지 않고 Capability 집합으로 섹션을 구성한다.
- 한 파일에 모든 조회/표시를 두지 않고 `dashboard/application`의 section provider로 분리한다.
- KPI 카드만 나열하지 않고 My Tasks, Alerts, Pipeline, Project/Finance/Resource overview를 우선순위대로 제공한다.
- EXECUTIVE, SALES, FINANCE, PM, TEAM, EMPLOYEE용 section 조합을 정의한다.

## 4. 기존 Page 구조

현재 App Router route group은 `(auth)`, `(workspace)`, `(presentation)`으로 잘 분리되어 있다. 주요 화면은 다음과 같다.

- 개인: `/dashboard`, `/attendance`, `/leave`, `/approvals`, `/notifications`, `/assets`, `/projects`, `/work-logs`, `/weekly-reports`, `/expenses`, `/profile`, `/workforce-profiles/me`
- 운영/관리: `/admin/users`, `/admin/organizations`, `/admin/attendance`, `/admin/leave`, `/admin/approvals`, `/admin/assets`, `/admin/devices`, `/admin/projects`, `/admin/resources`, `/admin/workforce-profiles`, `/admin/corporate-cards`, `/admin/card-settlements`, `/admin/roles`, `/admin/settings`, `/admin/audit`
- 발표: `/presentation/weekly-reports`

페이지는 서버에서 `requirePage`/`requireAnyPage`로 보호되고, client component에는 필요한 DTO와 capability만 전달한다. 이 패턴은 유지한다.

문제는 프로젝트 상세가 하나의 큰 client component와 client-only tab state로 구성되어 직접 링크, Breadcrumb, 부분 loading/error 경계가 약하다는 점이다. 장기적으로 `/projects/[id]/billing` 같은 URL 기반 하위 페이지로 나누고 공통 프로젝트 header/layout을 공유해야 한다.

## 5. 기존 주요 Domain

| Domain | 현재 구현 | 판단 |
| --- | --- | --- |
| Identity/User | Supabase Auth + `employees`, REQUESTED/ACTIVE 상태 | 유지 |
| Organization/RBAC | 조직 tree, 다중 Role, Permission, RLS helper | 유지·확장 |
| Attendance/Leave | 정책, 이벤트, 요약, 검증, 휴가 원장 | 유지 |
| Approval | subject/request/step/routing policy | 엔진 유지, request type 확장 |
| Notification/Email | 인앱 알림, durable outbox, delivery attempt | 유지·템플릿 확장 |
| Asset/Device | 자산 원장, 지급 이력, 등록 장치 | 유지 |
| Project/Resource | 프로젝트, 투입, WBS, milestone, issue, staffing | 핵심 허브로 확장 |
| Work Management | 일일업무, 주간보고 snapshot | 유지·프로젝트/보고 UX 개선 |
| Expense/Card | 법인카드, 할당, 비용, 영수증, 월 정산 | 일반 비용으로 확장 |
| Workforce Profile | 기술/학력/자격/프로젝트 경력 | 유지 |
| Audit/Settings | row audit, version, company setting | 유지·재무 정책 확장 |
| Customer/Sales/Contract | 없음. `projects.customer_name` 문자열만 존재 | 신규 |
| Billing/Tax/Payment/P&L | 없음. 카드 비용 집계만 존재 | 신규 |
| Generic Documents/Inspection | 영수증과 정산 파일 외 없음 | 신규 |

## 6. 기존 기능 간 관계

현재 연결된 흐름은 다음과 같다.

```text
employees ─┬─ organizations / roles / permissions
           ├─ attendance / leave ─ approval ─ notifications/outbox
           ├─ project_assignments ─ projects ─ tasks/milestones/issues
           ├─ daily_work_logs ───── projects/tasks
           ├─ weekly_reports (직원/주 단위 snapshot)
           └─ expenses ─ corporate_cards ─ monthly_card_reports

projects ─ project_assignments / staffing / work logs / expenses
all important mutations ─ audit_logs
```

좋은 연결은 이미 존재한다. 특히 일일업무의 project/task FK, 비용의 project FK, 프로젝트 상세의 업무·비용 탭, 프로젝트 투입과 인력프로필 연결은 그대로 재사용한다.

단절 지점은 프로젝트 이전과 이후다.

```text
[Customer → Opportunity → Quotation → Contract]  X  Project  X  [Inspection → Billing → Tax Invoice → Payment]
```

## 7. 문제점 및 중복 위험

1. 고객사가 `projects.customer_name` 문자열이라 동일 고객의 거래 이력을 묶을 수 없다.
2. 범용 Approval schema는 있으나 실질 mutation은 휴가 중심이다. 견적/계약용 subject adapter와 완료 callback이 필요하다.
3. `expenses.corporate_card_id`가 필수여서 출장·외주·구매·클라우드 등 비카드 비용을 표현할 수 없다.
4. `project_assignments`에는 투입률은 있으나 계획 MM, 실제 공수, 원가 rate, billing rate의 기준일/스냅샷이 없다.
5. 프로젝트의 재무 Source of Truth가 없어 계약금액·청구·수금·미수·P&L을 계산할 수 없다.
6. 파일 모델이 영수증과 정산 파일에만 특화되어 계약/견적/검수/산출물을 연결할 수 없다.
7. 상태 label/color/transition이 도메인과 component에 분산되어 있다.
8. Table은 primitive만 공통이며 검색·필터·정렬·열·Export 패턴은 페이지별로 반복될 가능성이 높다.
9. `CommandForm`은 단순 CRUD에 유용하지만 견적 line item, 부분입금 배분, 문서 업로드 같은 복합 편집에는 부족하다.
10. Dashboard와 Project Detail의 props/data fetch가 커져 변경 영향도가 높다.
11. GET 조회와 mutation 모두 권한 검사를 하고 있으나, 신규 도메인에서는 UI 노출 권한과 DB row scope를 동일한 permission catalog에서 파생해야 한다.
12. 삭제 대신 archive/soft delete가 일부 도메인에만 적용되어 있다.

중복 생성을 피해야 할 대표 사례:

- Client/Company를 따로 만들지 않고 `customers` 하나로 통일한다.
- ProjectMember를 새로 만들지 않고 `project_assignments`를 확장한다.
- Card Expense를 새 비용 시스템으로 복제하지 않고 `expenses`의 source subtype으로 유지한다.
- 새 승인 엔진을 만들지 않고 `approval_subjects/requests/steps`를 확장한다.
- 새 메일 큐를 만들지 않고 `notification_outbox`를 사용한다.
- 새 history 테이블을 도메인마다 만들지 않고 `audit_logs`와 명시적 revision/snapshot을 조합한다.

## 8. A/B/C 최종 판단

### A. 유지해야 할 구조

- App Router route group과 서버 컴포넌트 중심 페이지
- Supabase Auth와 `employees` 분리, ACTIVE gate
- Permission 중심 RBAC, 조직/프로젝트 scope, RLS
- Zod command → application service → repository → DB RPC 구조
- request id, idempotency key, optimistic version, Conflict 처리
- 범용 Approval subject/request/step/routing schema
- Notification + Outbox + Email provider
- Audit trigger와 before/after snapshot
- `projects`, `project_assignments`, staffing/WBS/milestone/issue
- `daily_work_logs`, `weekly_reports`
- `expenses`, `corporate_cards`, card settlement
- private Supabase Storage와 인증된 다운로드
- 기존 UI primitive와 반응형 shell

### B. 확장에 맞춰 수정할 구조

- `projects`: customer/contract/opportunity/quotation/sales owner/closing FK 및 상태 확장
- `project_assignments`: 계획 MM·원가/청구 rate 연결, 실제 공수 집계
- `expenses`: 카드 전용 필수 관계를 일반 비용 source로 확장
- Approval application layer: 휴가 전용 command를 request-type adapter registry로 확장
- Navigation: 단일 정의 tree와 Permission 기반 group/filter로 통합
- Dashboard: capability별 section provider로 분리
- Project Detail: URL 기반 sub-navigation과 server-side tab page로 분할
- Breadcrumb/Status/Table/Empty/Error 패턴 공통화
- Settings: 시스템 설정과 업무 Master Data를 구분
- Audit UI: entity timeline과 프로젝트/고객 상세 History 탭 제공

### C. 신규로 만들 구조

- Customer/Contact
- Opportunity/Sales pipeline
- Quotation/Revision/Line item/PDF snapshot
- Contract/Amendment/PO
- Generic business document metadata/link
- Inspection/acceptance
- Billing schedule/Billing
- Tax invoice
- Company bank account
- Payment/Payment allocation
- Vendor/expense type/external cost
- Project financial summary/P&L/closing snapshot
- Global search index/query
- Sales/Finance/Executive permissions와 role bundles

## 9. 변경되는 최종 Navigation

메뉴를 줄이는 것이 아니라 사용 목적을 명확히 한다. 하나의 typed navigation tree가 label, icon, href, breadcrumb, required permissions, quick actions를 함께 가진다.

```text
홈
└─ 대시보드

나의 업무
├─ 오늘 업무                  /work-logs
├─ 주간보고                  /weekly-reports
├─ 내 프로젝트               /projects?scope=mine
├─ 결재함                    /approvals
├─ 근태 · 휴가               /attendance, /leave
├─ 내 비용                   /expenses?scope=mine
├─ 알림                      /notifications
└─ 내 프로필 · 자산          /profile, /assets

영업
├─ 고객사                    /customers
├─ 영업기회                  /opportunities
├─ 견적                      /quotations
├─ 승인 대기                 /approvals?type=QUOTATION,CONTRACT
└─ 계약 · 발주               /contracts

프로젝트
├─ 전체 프로젝트             /projects
├─ 프로젝트 인력 · 공수      /resources
├─ 인력 기술 현황            /workforce-profiles
├─ 프로젝트 문서             /documents?scope=project
└─ 검수 · 완료               /inspections

재무
├─ 청구 일정                 /finance/billing-schedules
├─ 청구                      /finance/billings
├─ 세금계산서                /finance/tax-invoices
├─ 입금                      /finance/payments
├─ 미수금                    /finance/receivables
└─ 프로젝트 손익             /finance/project-pnl

비용
├─ 비용 내역                 /expenses
├─ 법인카드                  /corporate-cards
├─ 월 정산                   /card-settlements
└─ 거래처 · 외주비           /vendors

보고 · 분석
├─ 영업 Pipeline             /reports/sales
├─ 프로젝트 현황             /reports/projects
├─ 매출 · 수금               /reports/revenue
├─ 손익 분석                 /reports/profitability
├─ 인력 현황                 /reports/resources
└─ 비용 분석                 /reports/expenses

운영 관리
├─ 직원 · 조직               /admin/users, /admin/organizations
├─ 근태 · 휴가 · 정책        기존 admin route
├─ 자산 · 장치               기존 admin route
├─ 권한                      /admin/roles
├─ Master Data               /admin/master-data
├─ 회사 계좌                 /admin/bank-accounts
├─ 시스템 설정               /admin/settings
└─ 감사 로그                 /admin/audit
```

노출 규칙:

- EMPLOYEE: 나의 업무와 본인 scope
- TEAM_MANAGER: 본인 메뉴 + 관리 조직 업무/주간보고/근태/휴가
- PROJECT_MANAGER: 담당 프로젝트, 인력/공수, 프로젝트 비용·문서·검수
- SALES: 고객/영업기회/견적/계약과 담당 프로젝트 조회
- FINANCE_MANAGER: 청구/세금계산서/입금/미수/비용/카드/P&L
- EXECUTIVE: 전사 Dashboard와 보고/분석 read-only
- ADMIN: 전체 기능과 운영 관리

실제 판단은 Role 문자열이 아니라 Permission으로 한다. Role은 Permission bundle일 뿐이다.

## 10. 변경되는 Dashboard

### 공통 상단

- 역할에 맞는 인사말과 기준일
- My Tasks: 승인, 주간보고, 비용 증빙, 청구/세금계산서/수금, 검수, 프로젝트 마감
- 권한 기반 Quick Action

### EMPLOYEE

- 오늘 출퇴근/업무시간, 일일업무, 주간보고 상태
- 참여 프로젝트, 제출/보완 필요한 비용, 결재/알림

### PM

- 담당 프로젝트 진행률/일정/인력/과투입
- 비용, 검수, 청구 상태, 종료 예정, open issue/risk

### SALES

- Pipeline 단계별 건수/금액, 견적/계약 전환율
- 만료 임박 견적, 승인 대기, 담당 고객/기회

### FINANCE

- 이번 주 청구 예정, 세금계산서 미발행, 입금 예정/연체
- 월 청구/입금/미수, 카드 미정리, 프로젝트 비용

### EXECUTIVE

- 계약/청구/입금/미수/연체/P&L KPI
- 프로젝트별 수익성, Pipeline, 인력 가동률

Dashboard query는 섹션별 service로 분리하고 같은 request 안에서 병렬 실행한다. 민감한 P&L은 Permission이 없으면 query 자체를 실행하지 않는다.

## 11. 변경되는 Page Hierarchy

```text
/customers/[customerId]
  overview | contacts | opportunities | quotations | contracts
  projects | billings | payments | documents | history

/opportunities/[opportunityId]
  overview | activities | quotations | contracts | history

/quotations/[quotationId]
  overview | revisions/[revisionId] | approval | pdf | history

/contracts/[contractId]
  overview | amendments | documents | billing-schedule | approval | history

/projects/[projectId]
  overview | contract | quotation | team | resources | work | weekly-reports
  expenses | documents | inspections | billing | tax-invoices | payments | pnl | history

/finance/billings/[billingId]
  overview | tax-invoices | payments | documents | history
```

각 detail root는 서버 layout에서 header, status, 핵심 식별자, breadcrumb, 권한을 제공한다. 하위 페이지는 필요한 데이터만 조회한다. 기존 `/admin/projects/[id]`는 canonical project URL로 redirect하거나 동일 server component를 재사용하여 링크를 깨지 않게 한다.

## 12. 신규 ERP 전체 Domain 관계

```text
Customer 1─N Contact
Customer 1─N Opportunity
Opportunity 1─N Quotation
Quotation 1─N QuotationRevision 1─N QuotationItem
QuotationRevision 0..1─1 ApprovalSubject─1 ApprovalRequest─N ApprovalStep
Approved QuotationRevision 1─N Contract/ContractAmendment
Contract 0..1─1 Project

Project 1─N ProjectAssignment ─N Employee
Project 1─N DailyWorkLog
Project 1─N Expense (CorporateCard는 선택적 source)
Project 1─N Inspection
Project 1─N BillingSchedule 1─N Billing
Billing 1─N TaxInvoice
Payment N─M Billing via PaymentAllocation
Project 1─N DocumentLink

ProjectFinancialSummary =
  approved contract amount
  + billed/tax-issued/received/outstanding
  - labor/card/general/external cost

Project Closing → immutable closing snapshot + mutation lock
```

`weekly_reports`는 직원/주 단위 Source of Truth를 유지하고 프로젝트별로 복제하지 않는다. 확정 snapshot 안의 project-linked daily entries를 프로젝트 상세에서 필터링해 보여준다.

## 13. 주요 업무 Flow와 상태 전이

### 영업 → 프로젝트

1. Customer 생성
2. Opportunity `LEAD → PROPOSAL → QUOTATION → NEGOTIATION → WON/LOST`
3. Quotation 생성, immutable Revision V1..N 작성
4. 선택 Revision을 `DRAFT → PENDING_APPROVAL → APPROVED/REJECTED/CANCELLED`
5. 승인된 Revision만 Contract 생성 가능
6. Contract `DRAFT → PENDING_APPROVAL → APPROVED → SIGNED → ACTIVE`
7. SIGNED/ACTIVE Contract에서 Project를 멱등 생성

### 수행 → 재무

1. Project 인력 배정과 cost/billing rate snapshot
2. Daily work로 실제 공수 집계
3. Card/general/external expense 등록
4. Inspection 승인
5. Billing Schedule 조건 충족 후 Billing 생성
6. Billing 확정 후 Tax Invoice 입력/발행
7. Payment 등록 후 Payment Allocation
8. Outstanding과 상태 자동 재계산
9. 모든 완료 조건 확인 후 Project Closing

허용되지 않은 상태 전이는 DB command가 거절한다. 승인 완료, 계약/프로젝트 전환, 청구/입금 합계 변경은 단일 transaction으로 처리한다.

## 14. Role별 접근 구조와 신규 Permission

기존 62개 Permission을 유지하고 아래 capability를 추가한다. 이름은 역할이 아니라 행위를 나타낸다.

- `CUSTOMER_READ`, `CUSTOMER_MANAGE`
- `OPPORTUNITY_READ_SELF`, `OPPORTUNITY_READ_ALL`, `OPPORTUNITY_MANAGE`
- `QUOTATION_READ_SELF`, `QUOTATION_READ_ALL`, `QUOTATION_MANAGE`, `QUOTATION_APPROVE`, `QUOTATION_EXPORT`
- `CONTRACT_READ_SELF`, `CONTRACT_READ_ALL`, `CONTRACT_MANAGE`, `CONTRACT_APPROVE`
- `PROJECT_FINANCE_READ`, `PROJECT_FINANCE_READ_ALL`, `PROJECT_CLOSE`
- `DOCUMENT_READ`, `DOCUMENT_MANAGE`
- `INSPECTION_READ`, `INSPECTION_MANAGE`
- `BILLING_READ`, `BILLING_MANAGE`
- `TAX_INVOICE_READ`, `TAX_INVOICE_MANAGE`
- `PAYMENT_READ`, `PAYMENT_MANAGE`
- `BANK_ACCOUNT_MANAGE`
- `FINANCE_REPORT_READ`, `EXECUTIVE_DASHBOARD_READ`
- `MASTER_DATA_MANAGE`

Scope 원칙:

- SELF: 본인이 작성/담당/참여한 행
- TEAM: `private.manages_organization`으로 관리 조직
- PROJECT: 담당 PM 또는 프로젝트 배정자
- ALL: 전사
- FINANCE: 금융/원가 항목에 대한 별도 permission

프로젝트를 볼 수 있다는 이유만으로 원가·이익률까지 자동 노출하지 않는다. `PROJECT_READ`와 `PROJECT_FINANCE_READ`를 분리한다.

## 15. 유지 / 이동 / 통합 / 확장 표

| 기존 기능 | 처리 | 최종 위치/방식 |
| --- | --- | --- |
| 로그인/가입/계정상태 | 유지 | Auth |
| 직원/조직/역할 | 이동 없이 그룹 재배치 | 운영 관리 |
| 근태/휴가 | 유지 | 나의 업무 + 운영 관리 |
| 결재함 | 통합 | 휴가/견적/계약 공통 Inbox |
| 프로젝트 | 확장 | canonical `/projects`, 상세 허브 |
| 리소스/인력프로필 | 이동 | 프로젝트/보고 영역 |
| 일일업무/주간보고 | 유지·UX 개선 | 나의 업무, 프로젝트 상세 연결 |
| 비용/법인카드 | 통합·확장 | 비용 Domain, 프로젝트 P&L 연결 |
| 카드 월 정산/Excel/메일 | 유지 | 비용 → 월 정산 |
| Dashboard | 교체가 아닌 분해/확장 | role/capability section 조합 |
| 알림/Outbox | 확장 | ERP 전체 event template |
| 감사 로그 | 확장 | 전역 화면 + 각 상세 History |
| 시스템 설정 | 분리 | 시스템 설정 vs Master Data |

## 16. DB 변경안

### Phase 1: Customer/Sales/Quotation/Contract

신규 테이블:

- `customers`: 업무키, 사업자등록번호 unique, 회사/세금계산서/결제 정보, status, version, archived_at
- `customer_contacts`: 고객사 FK, 담당 유형, 연락처, primary flag, version, archived_at
- `opportunities`: customer/sales owner FK, 금액/date/probability/status, version, archived_at
- `quotations`: 견적 identity와 번호, opportunity/customer FK, current revision, lifecycle status
- `quotation_revisions`: immutable revision number, 금액/원가/이익 snapshot, validity, status, creator
- `quotation_items`: revision FK, role/headcount/MM/period/qty/unit price/amount/sort
- `contracts`: customer/opportunity/approved revision FK, 계약번호/기간/금액/조건/status/version
- `contract_amendments`: 변경 전후 조건과 승인된 version snapshot

기존 확장:

- `approval_subjects.request_type`에 `QUOTATION`, `CONTRACT`, `PROJECT_CLOSING` 허용
- `projects`에 nullable `customer_id`, `contract_id`, `opportunity_id`, `quotation_revision_id`, `sales_owner_id`, `closed_at`, `closing_snapshot`
- 기존 `customer_name`은 즉시 삭제하지 않고 backfill/호환 표시용으로 유지

### Phase 2: Project/Resource/Document/Inspection

- `employee_cost_rates`: 직원 effective date별 원가 rate
- `project_assignment_rates`: assignment별 cost/billing rate snapshot
- `project_assignments`에 `planned_mm` 선택 필드
- `documents`: file metadata, checksum, MIME, size, uploader, category, version, archived_at
- entity별 link table: `customer_document_links`, `quotation_document_links`, `contract_document_links`, `project_document_links`, `billing_document_links`
- `inspections`: project/milestone, 요청/예정/완료일, 고객 담당자, 결과, status, document FK

### Phase 3: Billing/Tax/Payment

- `billing_schedules`: contract/project, 조건, 예정일, supply/vat/total, status, sequence
- `billings`: schedule/customer/project/contract, billing number/date/due date, numeric amounts, status, version
- `tax_invoices`: billing/customer/project, issue number/date/status, numeric amounts, recipient email, version
- `company_bank_accounts`: 은행/마스킹 계좌/예금주/용도/active/version
- `payments`: customer/project/account, receipt date/amount/payer/reference, status/version
- `payment_allocations`: payment/billing, allocated amount, unique pair

### Phase 4: Expense/P&L/Closing

- `expense_types`와 `vendors` master
- `expenses.corporate_card_id` nullable 전환
- `expenses`에 `expense_type_id`, `vendor_id`, `source_type`, `approval_status`, `paid_at` 추가
- `external_cost_commitments` 또는 발주/외주 계약은 실제 운영 범위 확인 후 추가
- `project_financial_summary(project_id, as_of)` RPC
- `project_closing_check(project_id)` RPC
- `project_close` command가 검수/청구/세금/미수/문서 조건과 closing snapshot을 원자적으로 기록

### 공통 제약

- 금액 `numeric(14,2)` 또는 최대 계약 규모를 확인해 `numeric(18,2)` 통일
- 비율 `numeric(7,4)`, DB CHECK 0 이상
- VAT/total은 generated column 또는 command에서 서버 계산하고 입력값과 일치 검증
- document/file path는 private bucket, 공개 URL 금지
- 재무/계약 데이터 hard delete 금지; cancel/archive와 audit 사용
- number는 unique business key, revision은 `(parent_id, revision_no)` unique
- idempotency receipt 또는 request key unique
- 모든 신규 업무 테이블에 RLS, version, audit trigger, 주요 FK/검색 index

## 17. 신규 API / Service 설계

현재의 domain command 패턴을 유지한다. route 수를 action 수만큼 폭증시키지 않고 도메인 경계별 endpoint를 둔다.

| Endpoint | 주요 action |
| --- | --- |
| `/api/customer` | customer.save/archive, contact.save/archive |
| `/api/sales` | opportunity.save/transition |
| `/api/quotation` | create, revision.create, item.save, submit, cancel, pdf |
| `/api/contract` | create-from-quotation, submit, sign, amend, create-project |
| `/api/project-finance` | schedule.save, billing.create/transition, tax.save, payment.save/allocate, project.close |
| `/api/document` | metadata/create/link/archive, upload/download |
| `/api/inspection` | save/request/approve/reject |
| `/api/search` | permission-filtered global search GET |
| `/api/export/*` | quotation PDF, customer/project/finance Excel |

레이어별 책임:

- Route Handler: request id, body 제한, session 확인, HTTP 응답
- application command: Zod parse, capability check, use-case orchestration
- domain service: 상태 전이, 금액/세금/수익 계산 규칙
- repository: Supabase query/RPC 호출과 DTO parse
- PostgreSQL RPC: lock, 최종 권한 재검증, 원자적 변경, audit/outbox

파일 업로드는 metadata row 생성 → private Storage 업로드 → checksum/size finalize의 보상 transaction 패턴을 사용한다. 기존 영수증 업로드 패턴을 일반화한다.

## 18. 주요 Business Logic

### 견적

- 승인 제출 이후 revision 내용은 수정 금지; 수정은 새 revision 생성
- revision 합계 = line item 합계
- VAT와 총액은 서버 계산
- 승인된 revision 하나만 계약 기준으로 선택

### 계약/프로젝트 전환

- 승인된 quotation revision만 contract 생성 가능
- contract가 SIGNED/ACTIVE일 때만 project 생성 가능
- `(contract_id)` partial unique로 중복 project 생성 방지
- retry 시 같은 project를 반환하는 멱등 command

### 공수/인건비

- 계획 MM은 assignment와 기간/투입률로 검증
- 실제 시간은 project-linked daily work log 합계
- 인건비는 업무 발생일의 확정 cost rate snapshot으로 계산
- rate 변경이 과거 P&L을 바꾸지 않도록 snapshot 또는 effective-dated rate 사용

### 청구/세금계산서/입금

- billing 총액 = supply + VAT
- allocation 합계는 payment amount와 billing 잔액을 초과할 수 없음
- outstanding = billing total - valid allocations
- `PAID/PARTIALLY_PAID/OVERDUE`는 임의 입력이 아니라 금액과 due date로 파생
- 취소된 billing/tax/payment는 역분개/취소 상태로 보존

### P&L

```text
Contract Amount    = 유효 계약/변경계약 금액
Billed Amount      = 취소되지 않은 확정 청구
Received Amount    = 유효 입금 배분 합계
Outstanding Amount = Billed - Received
Labor Cost         = 실제 공수 × 확정 원가 rate
Expense            = 카드 + 일반 경비
External Cost      = 외주/구매 확정 비용
Total Cost         = Labor + Expense + External
Gross Profit       = Contract Amount - Total Cost
Profit Margin      = Contract Amount > 0 ? Gross Profit / Contract Amount : null
```

계산은 공통 SQL 함수와 server domain calculator를 같은 fixture로 검증한다. 화면은 반환값을 표시만 한다.

### 프로젝트 마감

- 검수 완료
- 청구 계획 처리 완료
- 세금계산서 정책 충족
- 미수금 0 또는 승인된 예외
- 비용/공수 마감
- 필수 문서 존재
- 조건 충족 후 closing snapshot, actor/time, approval reference 기록
- 마감 후 finance mutation은 reopen permission과 사유/승인을 요구

## 19. Migration 및 Compatibility

### 단계

1. Baseline: 현재 미적용 출퇴근 migration 적용 및 전체 gate 통과
2. Expand: nullable FK와 신규 테이블/permission/RLS/RPC 추가
3. Backfill: `projects.customer_name`을 normalized customer 후보로 변환하되 Preview 후 적용
4. Dual read: customer FK가 있으면 정식 customer, 없으면 legacy 문자열 표시
5. Switch: 신규 생성 project는 customer FK 필수, 기존 행은 예외 유지
6. Contract: 운영 데이터 검증 후에만 legacy 필드 제거 여부를 별도 결정; 초기 범위에서는 제거하지 않음

### URL 호환

- 기존 URL은 즉시 삭제하지 않는다.
- `/admin/projects` → canonical `/projects?scope=all`
- `/admin/projects/[id]` → `/projects/[id]`
- `/admin/corporate-cards` → `/corporate-cards`
- `/admin/card-settlements` → `/card-settlements`
- redirect 기간에도 기존 Permission 검사와 bookmark가 동작하도록 한다.

### 데이터 보존/배포

- 운영 DB 연결 대상이 명확하지 않으면 원격 migration 실행 금지
- migration 전 backup/row count/checksum
- backfill은 dry-run report와 collision list 제공
- 기존 migration 수정 금지, 새 migration만 추가
- 데이터 손실 rollback 대신 forward fix migration
- 생성 타입 drift 검사
- RLS 역할별 SQL integration test

## 20. 구현 우선순위

### Phase 0 — Baseline 안정화

- 미적용 attendance migration 검증/적용
- 현재 dirty worktree의 로그인/휴가/근태/Excel 변경을 독립 검증
- lint → typecheck → unit/integration test → build
- 기존 URL/page smoke와 실제 Auth/RLS 시나리오

### Phase 1 — Customer → Opportunity → Quotation → Approval → Contract

- Customer/Contact
- Opportunity
- Quotation Revision/Item/PDF
- 기존 Approval engine의 typed adapter
- Contract/PO와 signed contract → project 생성
- Sales navigation/dashboard

### Phase 2 — Project Hub

- canonical project routes와 호환 redirect
- project/customer detail 하위 route
- assignment rate/MM, documents, inspection
- 주간보고/업무/비용의 deep-link UX

### Phase 3 — Billing → Tax → Payment → Outstanding

- billing schedule, billing, tax invoice, bank account, payment allocation
- finance navigation/dashboard/alerts

### Phase 4 — Expense/P&L/Closing

- 일반 비용으로 expenses 확장
- project financial summary와 closing
- executive profitability dashboard

### Phase 5 — IA 공통화

- typed navigation, breadcrumb, status badge, data table pattern
- global search, quick action, notification action links
- loading/empty/error/no-permission 경계

### Phase 6 — 자동화/산출물

- Excel/PDF/email
- 견적/청구/수금/손익 보고
- 운영 cron과 alert

Phase 1부터는 기능별 vertical slice로 구현한다. 예를 들어 Customer만 화면까지 만든 뒤 Opportunity를 시작하는 것이 아니라 Customer + DB/RLS/API/page/test를 완결하고 다음 slice로 이동한다.

## 21. 단계별 종료 Gate

각 vertical slice와 phase마다 아래 순서를 모두 통과한다.

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npx supabase db lint --local --level warning`
5. 실제 로컬 Auth + RLS + RPC integration test
6. `npm run build`
7. 브라우저에서 직원/PM/Sales/Finance/Admin 역할별 핵심 flow 검증
8. 기존 근태/휴가/업무/카드/프로젝트 회귀 확인

실행할 수 없는 gate는 통과로 기록하지 않고 환경 제한으로 남긴다.

## 22. 첫 구현 단위의 완료 조건

가장 먼저 구현할 Customer vertical slice의 완료 조건은 다음과 같다.

- 기존 프로젝트/직원/근태/비용 데이터 무변경
- customer/contact migration, RLS, audit, permission
- customer command와 repository
- 목록/상세/등록/수정/보관 화면
- 사업자번호/이름 중복 검증
- 고객 상세의 Project legacy 연결 Preview
- 기존 `projects.customer_name`을 임의 자동 병합하지 않음
- 직원/Sales/Admin 역할별 접근 테스트
- 전체 품질 gate 통과

이 단위가 안정된 뒤 Opportunity와 Quotation을 연결한다.

## 23. 2026-09-26 구현 진행 현황

Docker 기반 로컬 Supabase에 forward-only migration을 적용하고 다음 vertical slice를 완료했다.

### 완료: Customer / Contact

- 고객사 및 담당자 기준정보, RLS, 감사 로그, 멱등 command
- 목록/상세/등록/수정/보관 UI
- 기존 `projects.customer_name` 보존 및 고객 상세의 legacy 후보 표시

### 완료: Opportunity

- 고객사/담당 영업/예상 프로젝트/금액/기간/확률/제안일/경쟁사/비고
- 예상매출 서버 파생 계산
- `LEAD → PROPOSAL → QUOTATION → NEGOTIATION → WON/LOST` 상태 머신
- 담당 영업 소유권과 전체 조회 권한을 분리한 RLS
- 목록/상세/수정/단계 변경/보관 UI

### 완료: Quotation Revision / Approval

- 견적 Header와 인력 Role·인원·MM·기간·수량·단가 기반 Detail
- 공급가액/VAT/총액/예상원가/이익/이익률 DB 파생 계산
- Revision 복제와 이전 버전 불변 보존
- 범용 `approval_subjects/requests/steps`에 `QUOTATION` adapter 연결
- 결재함에서 견적 승인/반려, 승인 이후 Revision 잠금
- 목록/상세/항목 편집/Revision History UI

### 검증 결과

- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `npm test`: 16 files, 79 tests 통과
- `npx supabase db lint --local --level warning`: schema issue 없음
- `npm run build`: 통과
- 실제 Sales 역할 로그인 후 `/opportunities`, `/quotations`, 견적 상세 화면 확인
- 브라우저 console error/warning 없음

다음 구현 단위는 승인된 견적에서 Contract를 생성하고, 계약 확정 후 기존 Project에 FK를 연결해 멱등 생성하는 흐름이다.

## 24. 2026-09-27 Phase 1 완료

### 완료: Contract / Signed Contract → Project

- 승인된 견적 Revision만 계약 초안으로 전환하고 고객사·영업기회·견적 연결을 보존
- 계약 공급가액/VAT/총액의 DB 파생 계산과 계약 변경 이력(snapshot) 보존
- `DRAFT/REJECTED → SUBMITTED → APPROVED → SIGNED → ACTIVE` 상태 전이
- 범용 `approval_subjects/requests/steps`에 `CONTRACT` adapter 연결
- 결재함에서 계약 조건과 금액을 확인하고 승인/반려
- 서명일 확정 후 기존 `projects`에 고객사·계약·영업기회·견적·담당 영업 FK를 승계해 멱등 생성
- 담당 영업 소유권과 전체 조회/승인 권한을 분리한 RLS
- 계약 목록/상세/수정/승인 요청/서명/프로젝트 전환/변경 이력 UI

### 검증 결과

- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `npm test`: 17 files, 81 tests 통과
- `npx supabase db lint --local --level warning`: schema issue 없음
- `npm run build`: 통과
- 실제 Admin 로그인 후 `/contracts` 메뉴, 목록, 상태 필터, 빈 상태 화면 확인
- 브라우저 console error/warning 없음

이로써 Phase 1의 `Customer → Opportunity → Quotation → Approval → Contract → Project` 연결을 완료했다. 다음 구현 단위는 Phase 2 Project Hub의 canonical route와 기존 `/admin/projects` 호환 redirect, 고객/계약/업무/비용 deep-link 정리다.

## 25. 2026-09-27 Phase 2 완료

### 완료: Project Hub / Resource / Document / Inspection

- 관리자용과 개인용으로 분리되어 있던 프로젝트 진입점을 canonical `/projects`와 `/projects/[id]`로 통합
- 기존 `/admin/projects`, `/admin/projects/[id]` bookmark는 canonical URL로 호환 redirect
- 프로젝트 허브에서 개요, 업무일지, 주간보고 Snapshot, 비용, MM·단가, 문서, 검수로 직접 이동
- 기존 일일업무의 프로젝트 연결을 유지하고 실제 업무시간을 `160시간 = 1MM` 기준으로 계획 MM 옆에 표시
- 직원 effective-date 원가 기준과 assignment별 계획 MM·월 원가·월 청구 단가 Snapshot 이력 보존
- 직원 원가 기준은 별도 Permission/RLS로 보호하고 일반 직원 및 담당 PM에게 노출하지 않음
- 프로젝트 문서는 private Storage를 사용하고 MIME/50MB 제한, SHA-256, uploader, 버전 연결, 이전 버전 자동 보관을 적용
- RFP, 제안서, 견적서, 계약서, 발주서, 착수계, 계획서, 주·월간보고, 변경요청서, 산출물, 검수/완료보고서, 청구/세금계산서 등 실무 문서 분류 지원
- 검수는 프로젝트/마일스톤/증빙 문서를 연결하고 요청·예정·완료일, 고객 담당자, 상태, 결과, 버전 충돌을 관리
- 프로젝트 담당 PM 또는 전사 관리 권한만 단가·문서·검수를 변경하며, 배정 직원은 허용된 문서/검수 조회만 가능
- 신규 테이블은 explicit Data API grant, RLS, audit trigger, idempotency receipt를 적용

### 검증 결과

- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `npm test`: 18 files, 85 tests 통과
- `npx supabase db lint --local --level warning`: schema issue 없음
- `npm run build`: 통과
- 실제 Admin 세션에서 `/projects`, 프로젝트 상세, MM·단가, 문서, 검수 화면 렌더링 확인
- 신규 화면의 Next.js error overlay 및 browser console error/warning 없음

Phase 2까지 `Customer → Opportunity → Quotation → Approval → Contract → Project → Resource/Work/Document/Inspection` 흐름을 연결했다. 다음 구현 단위는 Phase 3의 `Billing Schedule → Billing → Tax Invoice → Payment Allocation → Outstanding`이다.

## 26. 2026-09-27 Phase 3 완료

### 완료: Billing / Tax Invoice / Payment / Outstanding

- `/finance/billing-schedules`에서 계약 프로젝트별 착수금·중도금·잔금 청구 일정과 VAT/합계를 관리하고 청구서 초안으로 전환
- `/finance/billings`에서 청구금액, 부분입금, 완납, 입금기한 경과 연체, 미수잔액을 하나의 원장으로 조회
- `/finance/tax-invoices`에서 공급자·공급받는자 Snapshot, 최대 99개 품목, 작성일자, 공급일자, 공급가액, 세액, 영수/청구, 수신 이메일을 관리
- 세금계산서 PDF는 Pretendard 한글 폰트를 포함한 A4 문서로 생성하며 다중 페이지 품목과 공급자/공급받는자, 합계, 수금계좌를 출력
- 미발급 PDF에는 `발행 전` 표시와 법적 전자발급 완료 문서가 아니라는 안내를 출력
- 홈택스·등록 ASP·인증 ERP에서 실제 발급한 24자리 국세청 승인번호를 기록해야만 `ISSUED` 상태로 전환
- `/finance/payments`에서 입금내역을 등록하고 복수 청구서에 부분 배분하며, 입금액 및 청구잔액 초과 배분을 DB transaction에서 차단
- 입금 취소 시 배분 이력은 보존하고 연결 청구서의 부분입금/완납 상태를 원자적으로 재계산
- 공급자 세무정보와 수금계좌는 `/finance/settings`에서 별도 관리하고 finance Permission과 RLS로 보호
- 발행자료 확정, 전자발급 완료 기록, 청구·입금 취소에 사용자 확인 절차와 optimistic version 충돌 방지 적용
- 신규 테이블은 explicit Data API grant, RLS, audit trigger, idempotency receipt, soft cancel 정책을 적용

### 전자세금계산서 운영 경계

- ERP PDF는 발행자료와 국세청 승인번호가 기록된 발행내역의 보관·확인 출력물이다.
- 법적 전자세금계산서 발급은 홈택스 또는 국세청에 등록된 ASP/인증 ERP에서 전자서명·전송해야 한다.
- 외부 발급 결과를 승인번호와 발급 채널로 기록하여 `READY`와 `ISSUED`를 명확히 분리한다.

### 검증 결과

- `npx supabase db reset`: 전체 migration 재적용 통과
- `npx supabase db lint --level warning`: schema issue 없음
- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `npm test`: 20 files, 89 tests 통과
- DB 통합 테스트에서 청구 일정 → 청구 확정 → 세금계산서 품목 저장/확정 → 승인번호 기록 → 부분입금 → 완납과 초과배분 차단 검증
- `npm run build`: 39개 App Router page 생성 및 PDF route 포함 통과
- 실제 Admin 세션에서 재무 설정, 청구 일정, 청구 원장, 세금계산서 원장, 입금 원장 렌더링 확인
- A4 PDF를 이미지로 렌더링해 한글, 표, 합계, 승인번호, 수금계좌와 단일 페이지 레이아웃을 육안 검증

Phase 3까지 `Customer → Opportunity → Quotation → Approval → Contract → Project → Billing → Tax Invoice → Payment Allocation → Outstanding` 흐름을 연결했다.

## 27. Phase 4 구현 결과 (2026-09-27)

### 일반 비용 원장

- 기존 `expenses`를 복제하지 않고 법인카드 선택 관계를 nullable로 확장하고 `CARD/CASH/TRANSFER/INVOICE/OTHER` source를 통합했다.
- `expense_types`, `vendors` master와 `/vendors` 관리 화면을 추가했다.
- 비용 유형의 VAT 공제 여부는 비용 저장 시 snapshot으로 고정하여 이후 master 변경이 과거 프로젝트 손익을 바꾸지 않는다.
- `/expenses`에서 카드·현금·이체·세금계산서 비용을 작성, 증빙 첨부, 제출, 승인/반려, 지급 완료까지 처리한다.
- 기존 카드 비용과 월 정산 흐름은 유지하며 카드 정산 집계는 `source_type='CARD'`만 포함한다.
- 신규 mutation은 request id 기반 멱등 처리, optimistic version, RLS, explicit grant, audit trigger를 적용했다.

### 프로젝트 손익

- `project_financial_summary(project_id, as_of)`와 portfolio RPC를 추가했다.
- 계약 공급가액, 청구, 전자발급 세금계산서, 수금 배분, 미수금, 계획 인건비, 실제 공수 원가, 승인 비용, 총원가, 이익과 이익률을 하나의 기준일로 계산한다.
- 실제 인건비는 업무일지 공수와 업무 발생일 이전에 확정된 assignment rate snapshot을 우선 사용하고, 없으면 effective-dated employee cost rate를 사용한다.
- `/finance/project-pnl`에 전사/권한 범위 손익 원장을, `/projects/[id]/pnl`에 프로젝트별 상세 손익과 비용 유형별 원가를 추가했다.

### 프로젝트 마감

- 검수 합격, 유효 계약, 청구계획 처리, 청구 확정, 전자세금계산서 발급, 미수금 0, 비용 승인·지급, 공수/투입 종료, 필수 문서를 `project_closing_check`에서 일괄 점검한다.
- `/projects/[id]/closing`에서 조건별 실패 사유를 확인하고 조건 충족 시 손익/체크리스트를 불변 closing snapshot으로 확정한다.
- 마감 후 업무일지, 비용, 청구일정, 청구서, 세금계산서, 입금, 수금 배분 변경을 DB trigger에서 차단한다.
- `PROJECT_REOPEN` 권한과 5자 이상의 사유로만 재개방하며 마감/재개방 이력을 보존한다.

### 검증 결과

- `npx supabase db reset`: 전체 migration 재적용 통과
- `npx supabase db lint --level warning`: schema issue 없음
- `npm run lint`, `npm run typecheck`: 통과
- `npm test`: 22 files, 92 tests 통과
- DB 통합 테스트에서 일반 비용 등록 → 제출 → 승인/지급 → 실제 공수 원가 → 손익 → 마감 → mutation 잠금 → 재개방 검증
- `npm run build`: 40개 App Router page 생성 및 Phase 4 API/page 포함 통과

다음 구현 단위는 Phase 5의 `Typed Navigation → 공통 Breadcrumb/Status/Data Table → Global Search/Quick Action → Permission/Loading/Empty/Error Boundary`이다.

## 28. Phase 5 구현 결과 (2026-09-27)

### Typed IA와 공통 UI

- 메뉴, 그룹, 아이콘, Permission, 빠른 실행을 `navigation` 단일 타입 정의로 통합했다.
- 상세 URL까지 인식하는 longest-prefix active route와 프로젝트 하위 화면 Breadcrumb를 공통화했다.
- 기존 상단의 고정 `업무관리` 표시를 실제 `업무 영역 → 목록 → 상세 기능` 계층으로 교체했다.
- 공통 `StatusBadge`, `DataTable`, `LoadingState`, `EmptyState`, `NoPermissionState`, `NotFoundState`를 추가했다.
- Next.js `loading.tsx`, `error.tsx`, `forbidden.tsx`, `not-found.tsx` 경계를 구성하고 page Permission 실패는 403 전용 화면으로 연결했다.

### Global Search / Quick Action / Notification Action

- `/search`에서 고객사, 영업기회, 견적, 계약, 프로젝트, 청구, 세금계산서, 입금을 하나의 결과 표로 검색한다.
- 검색 대상 자체를 사용자 Permission으로 제한하고 각 조회는 기존 Supabase RLS를 그대로 통과하므로 화면 권한 밖 데이터는 결과에 포함되지 않는다.
- 상단 검색창과 모바일 검색 진입점을 추가하고, 상태·업무코드·최근 변경일·상세 링크를 공통 표로 표시한다.
- 빠른 실행은 권한에 따라 업무일지, 휴가, 비용, 고객, 영업기회, 견적, 청구, 입금 작업만 노출한다.
- 알림의 `reference_type/reference_id`를 안전한 내부 업무 URL로 변환하여 `업무 열기` 링크를 제공하고 기존 읽음 처리를 유지한다.

### 검증 결과

- `npm run lint`, `npm run typecheck`: 통과
- `npm test`: 23 files, 95 tests 통과
- `npm run build`: 40개 App Router page와 `/search` 포함 통과
- 브라우저에서 상세 프로젝트 Breadcrumb, 권한별 빠른 실행의 마우스/키보드 열기와 Escape 닫기, 통합 검색 결과, 알림 업무 링크를 확인
- 브라우저 console error/warning 및 Next.js error overlay 없음

다음 구현 단위는 Phase 6의 `Excel/PDF 표준화 → 주기 작업/알림 자동화 → 운영 산출물과 배포·백업 Runbook`이다.
