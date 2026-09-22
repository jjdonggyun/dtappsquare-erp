# Leave / Approval / Notification 설계 · Phase 3

Phase 3 구현이 완료되었다. 물리 스키마는 `20260912150533_phase3_leave_approval_notification.sql`, 서버 유스케이스는 `src/server/leave-approval.ts`, 화면은 `/leave`, `/approvals`, `/notifications`, `/admin/leave`, `/admin/approvals`가 기준이다. Approval Engine은 Leave 전용 컬럼 없이 request_type/reference_id와 subject registry로 업무 대상을 참조한다.

Leave는 ANNUAL/HALF_DAY_AM/HALF_DAY_PM/SICK/SPECIAL/OTHER, 상태는 DRAFT/REQUESTED/APPROVED/REJECTED/CANCELED다. 기간·반차·duration을 검증하고 잔액은 부여/조정/예약/사용/취소 원장에서 계산한다. 자동 연차 발생 규칙을 임의로 하드코딩하지 않는다.

제출 transaction은 subject registry, 신청 REQUESTED, 잔액 예약, ApprovalRequest, ordered steps, 현재 결재자 notification/outbox, audit를 생성한다. 승인 경로는 소속 리더를 기본으로 하고 require_parent_approval 정책에 따라 상위 리더를 추가한다. 중복/자기결재를 제외하고 유효한 결재자가 없으면 제출을 거절한다. HR 대체 담당자가 정책에 명시되어 있으면 해당 담당자를 사용한다.

request를 FOR UPDATE로 잠그고 ACTIVE, LEAVE_APPROVE, current step approver, expected version을 검증한다. 한 단계 승인 시 다음 step에 알리고 마지막 승인에서는 application handler가 Leave APPROVED와 잔액 확정을 동일 transaction에 적용한다. 반려 시 request/Leave REJECTED와 뒤 step CANCELED, 예약 해제, 알림을 기록한다. 승인 전 신청 취소는 requester에게 허용하며 승인 후 취소는 별도 HR 권한과 원장 환원을 요구한다.

NotificationService는 업무 transaction에서 전송 의도를 저장한다. EmailProvider는 `send(message,idempotencyKey)`를 제공하고 SMTP/Resend adapter가 실제 전송을 담당한다. provider가 설정되지 않거나 전송에 실패해도 Leave/Approval transaction은 이미 commit된 상태로 유지된다.

outbox는 PENDING/PROCESSING/SENT/FAILED 상태, lease, attempt_count, next_attempt_at을 가진다. dispatcher는 SKIP LOCKED로 claim하고 전송 후 별도 transaction으로 결과를 기록한다. 실패는 업무 결과를 rollback하지 않는다. retry/backoff/dead-letter와 재전송 권한을 제공한다. 중복 전송은 provider idempotency로 완화하되 SMTP exactly-once를 주장하지 않는다. 도메인 event key unique로 알림 생성 재시도를 제거한다.

종료 테스트: 신청/route snapshot/순차 승인/최종 Leave 확정/반려/취소, 자기·타인·다음단계 거절, 동시 승인, 잔액 race, 이메일 실패 후 업무 commit 유지 및 lint/typecheck/test/build.
