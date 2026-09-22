# Phase 8 — 법인카드·프로젝트 비용·월 정산

## 범위와 기존 인프라

`modules/corporate-card`는 Project를 참조하지만 기존 Project, Approval, Notification, Audit를 교체하지 않는다. 카드의 전체 번호·CVC·비밀번호는 저장하지 않고 사내 식별자와 마지막 4자리만 저장한다. 영수증과 정산 Excel은 비공개 Supabase Storage 버킷에 두며 공개 URL을 만들지 않는다. 기존 `notification_outbox`에 외부 수신자와 보고서 참조를 허용하는 nullable 확장만 추가했다. SMTP/Resend `EmailProvider`의 기존 send 계약에는 선택적 attachment 필드만 더했다. 기존 휴가 메일은 attachment 없이 같은 경로를 사용한다.

## 모델과 무결성

| 테이블 | 핵심 불변식 |
|---|---|
| `corporate_cards` | 카드명·카드사·고유 사내 식별자·끝 4자리·상태·version. 전체 번호 없음. |
| `project_card_assignments` | 카드/프로젝트/책임자/할당 기간/상태/version. 동일 카드 기간 중첩을 advisory lock + trigger로 거절하고 종료 이력은 물리 삭제하지 않는다. |
| `expenses` | 사용일, 프로젝트/카드/사용자, 거래처·목적·구분, 공급가액·VAT 및 생성 합계, 영수증 키, soft delete, version. 카드가 해당 일자에 프로젝트에 할당되어야 한다. |
| `monthly_card_reports` | 기준월 1일 unique, `DRAFT → REVIEW → CLOSED → SENT`, 총 건수·공급가액·VAT·합계, 비용 행 스냅샷, 비공개 파일 키·SHA-256, 발송 세대, version. |

금액은 PostgreSQL `numeric(14,2)` 및 합계 generated column이다. 정산 집계는 DB에서 월별 Expense를 조회하여 행 스냅샷과 총계를 함께 저장한다. 마감 직전 현재 비용과 스냅샷을 다시 비교하며, 같은 달 비용 변경과 정산 생성은 동일한 DB 잠금을 사용한다. 검토 중 비용이 바뀌면 재집계와 Excel 재생성이 필요하다. `CLOSED/SENT` 월의 비용 변경·삭제·영수증 변경은 DB trigger와 RPC에서 거절한다. 재개방은 별도 `CARD_SETTLEMENT_REOPEN` 권한을 확인하고 대기 중 발송이 있으면 거절하며, 이전 메일 키와 구분하기 위해 발송 세대를 증가시킨다. 숫자 12~19자리만 입력한 사내 식별자는 카드 전체 번호로 오인될 수 있어 DB에서 거절한다.

## 권한과 API

`CORPORATE_CARD_READ/MANAGE`, `EXPENSE_READ_SELF/WRITE_SELF/READ_PROJECT/READ_ALL/MANAGE`, `CARD_SETTLEMENT_READ/MANAGE/SEND/REOPEN`을 명시적으로 매핑했다. `FINANCE_MANAGER` 역할을 추가했다. 본인 비용, PM 프로젝트 비용, 전사 비용의 읽기 범위는 RLS로 분리한다. 일반 mutation은 사용자 JWT의 `/api/corporate-card` → `corporate_card_command`를 거친다. 월 정산 자동 실행만 보호된 내부 endpoint에서 service role RPC를 사용한다. `project_expense_summary`는 카테고리·직원·카드 합계를 DB에서 반환한다.

- `/admin/corporate-cards`: 카드 등록·수정, 프로젝트 할당·종료 이력.
- `/expenses`, 프로젝트 상세 `비용 / 법인카드`: 비용 등록·수정·삭제, 영수증, 프로젝트 비용 분석.
- `/admin/card-settlements`: 월별 보고서, Excel 미리 생성/다운로드, 검토·마감·재개방, 테스트 메일·발송·재발송, 수신자별 최근 전송 시도.
- `/api/corporate-card/receipt`: MIME/10MB 검증 후 Private Storage 업로드·권한 확인 다운로드.
- `/api/corporate-card/settlement-file`: 보고서 스냅샷 기반 Excel 생성과 권한 확인 다운로드. Excel 문자열은 수식 시작 문자를 이스케이프한다.

## 자동 발송과 복구

`company_settings['corporate_card.settlement']`에 사용 여부, To/CC, 발송일·시간, `Asia/Seoul`, 제목 템플릿을 저장한다. 수신 주소는 코드에 없다. Vercel Cron은 매시 `/api/internal/monthly-card-settlement`을 호출하고 `CRON_SECRET` bearer로 보호한다. 내부 작업은 설정 시각 이후 전월 보고서를 생성/재사용하고 Excel 저장 → 검토/마감 → Outbox 삽입까지 수행한다. 별도 dispatcher가 메일을 실제 발송한다. 보고서 생성과 메일 실패는 서로 롤백되지 않는다.

Outbox 이벤트 키는 `corporate-card-settlement:YYYY-MM:gN:email-hash`이며 기존 unique constraint와 lease/retry/backoff/dead-letter를 그대로 사용한다. 같은 월 재실행은 중복 보고서·메일을 만들지 않는다. 수동 재발송은 명시적으로 새 세대를 부여한다. 모든 정산 수신자의 Outbox가 SENT일 때만 보고서를 SENT로 변경한다. 실패 이력과 최근 오류는 기존 `email_delivery_attempts`에서 읽는다. 테스트 메일은 별도 template이며 실제 정산 SENT 판정에서 제외한다.

## 검증과 운영 주의

로컬 DB 테스트로 카드 기간 충돌, 비용 관계/금액/RLS, 비공개 영수증 업로드·다운로드, 월별 실데이터 집계·unique, 오래된 스냅샷 마감 거절, CLOSED 수정 차단·재개방, Outbox 중복 키, provider 실패 후 재시도, SENT 및 수동 재발송을 확인한다. Excel 테스트는 실제 셀·합계·수식 이스케이프를 읽어 검증한다. 운영 전 `CRON_SECRET`, 실제 메일 provider/발신 도메인, 법인카드 수신자, Storage 정책을 구성한다. Vercel의 매시 Cron은 요금제에서 지원되는 간격인지 확인해야 하며, 발송 시각은 다음 매시 실행으로 최대 약 1시간 지연될 수 있다.
