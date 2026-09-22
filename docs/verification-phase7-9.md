# Phase 7~9 로컬 검증 결과

검증일: 2026-09-20 (Asia/Seoul)

## Baseline과 범위

Phase 1~6의 Employee/Organization, RBAC/RLS, Work Policy, Attendance, Leave, Approval, Notification/Email Outbox, Asset/Device, Project/Resource, Audit, Dashboard를 기존 구조 그대로 사용했다. Project 쪽 투입 가능 직원 검색, 조직·직급·기간·가용률 필터, 직원 드래그 배정, 다중 배정, Timeline 이동·크기 변경, Capacity API/Heatmap은 이미 존재했다. 빠져 있던 프로젝트 상세의 연결 업무 기록만 Phase 7에서 추가했다.

새 migration은 기존 파일을 편집하지 않고 Phase 7 업무관리, Phase 8 법인카드·비용·정산, 읽기 모델·권한 보완, Phase 9 대시보드·알림, 정산 재개방 및 스냅샷 일치성 보완 순으로 로컬 DB에 적용했다. 현재 로컬 DB에 사용자 데이터가 있을 수 있어 파괴적인 `supabase db reset`은 실행하지 않았다.

## 품질 gate

| 검사 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm test` | 6 files / 50 tests 통과 |
| `npm run build` | Next.js 16.3.4 production build 통과 |
| `npx supabase db lint --local --level warning --fail-on warning` | schema 오류 없음 |
| `npm run test:http` | Auth/권한/CSRF/입력/대시보드 9건 통과 |
| `npm audit --omit=dev` | 취약점 0건 |

## DB·업무 흐름

- 업무일지: 본인 작성, 타인 수정 거부, 프로젝트 NULL/연결, 팀장 관리 조직 범위, 다른 팀 차단, optimistic version 충돌을 실제 로컬 Auth/PostgreSQL에서 검증했다.
- 주간보고: 프로젝트 없는 ACTIVE 직원 포함, 초안/확정, 확정 후 업무일지를 수정해도 보고 스냅샷 불변을 검증했다.
- 법인카드: 카드 할당 기간 중복 거절, 할당 이력 유지, 비용 금액·프로젝트/카드 관계와 RLS를 검증했다.
- 영수증: 비공개 Storage 업로드·다운로드, 익명 다운로드 거부, 비용 version과의 연결을 검증했다.
- 정산: 실비용 월 집계·중복 보고서 방지, 검토 중 비용 변경 시 오래된 스냅샷 마감 거부, 재집계 후 마감, 마감월 비용 수정 거부, 관리자 재개방을 검증했다.
- Excel: 행 값·숫자 합계·수식 시작 문자열의 이스케이프를 workbook 셀에서 읽어 검증했다.
- Outbox: 동일 월 이벤트 키 중복 방지, provider 실패 기록과 재시도, 모든 발송 완료 시 SENT, 명시적 재발송 키 분리를 검증했다. 기존 Leave 승인/거절·Outbox 실패 회귀 테스트도 통과했다.

## 브라우저·로컬 웹

시드 관리자 세션으로 `/dashboard`, `/work-logs`, `/weekly-reports`, `/presentation/weekly-reports`, `/admin/corporate-cards`, `/admin/card-settlements`, 프로젝트 상세의 `업무 기록` 및 `비용 / 법인카드`, `/admin/settings`를 열었다. 기존 사이드바·카드·버튼·표 스타일을 유지하며 새 메뉴와 시스템 설정의 정산 링크가 표시되는 것을 확인했다. 로컬 개발 서버는 `http://localhost:3000`에서 실행 중이다.

## 운영 검증이 필요한 항목

실제 SMTP/Resend 자격 증명, 운영 수신자, Vercel Cron 환경과 운영 Supabase 프로젝트는 이 로컬 작업에 연결하지 않았다. 따라서 외부 정산 메일의 실제 도착과 운영 Cron 호출은 배포 환경에서 확인해야 한다. 로컬 테스트는 Outbox 생성·실패·재시도·상태 전이 및 비공개 파일 읽기까지 검증했다. 로컬 설정의 자동 발송 기본값은 OFF다.

## 후속 제안

1. 비용은 건별 수기 입력이다. 카드사 명세서의 파일 형식과 실제 사용량을 확인한 뒤 기존 `expenses`로 미등록 내역을 대조하는 가져오기 기능을 검토할 수 있다. 별도 회계 원장은 필요하지 않다.
2. 공휴일 원천 데이터가 없어 주간보고 미작성 분모는 승인된 전일 휴가까지만 제외한다. 회사가 사용하는 공휴일 정책을 Work Policy/Calendar와 연결하면 판정 정확도를 높일 수 있다.
3. `daily_work_logs.project_id`와 `project_assignments`를 이용해 계획 투입률과 실제 프로젝트 업무시간 비중을 비교하는 통계를 추가할 수 있다. 현재 일지는 근태 사실과 분리되어 있어 분석용으로만 사용해야 한다.
