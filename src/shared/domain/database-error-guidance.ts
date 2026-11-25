import type { ErrorCode } from "./errors";

type ErrorGuidance = {
  code: ErrorCode;
  message: string;
  hint: string;
};
type DatabaseErrorRule = ErrorGuidance & {
  databaseCodes: readonly string[];
  databaseMessages: readonly string[];
};

// Match only known application exceptions. Never send a raw database message to the browser.
const rules: readonly DatabaseErrorRule[] = [
  {
    databaseCodes: ["P0002"], databaseMessages: ["work policy not assigned"], code: "SetupRequired",
    message: "선택한 날짜에 적용되는 근무정책이 배정되지 않았습니다.",
    hint: "인사 관리자에게 근무정책 배정을 요청해 주세요. 관리자는 ‘근무정책’에서 정책을 생성한 뒤 ‘직원 정책 배정’에서 해당 직원에게 배정해야 합니다. 처리하려는 날짜가 적용 기간에 포함되어야 합니다.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["employee or policy not found"], code: "ValidationError",
    message: "배정할 활성 직원 또는 근무정책을 찾을 수 없습니다.",
    hint: "‘직원관리’에서 해당 직원의 승인·재직 상태를 확인하고, ‘근무정책’에서 사용할 정책을 생성한 뒤 직원과 정책을 다시 선택해 주세요.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["business role required", "business role required for leave approval"], code: "SetupRequired",
    message: "휴가 결재 경로를 결정할 직원의 업무 역할이 설정되지 않았습니다.",
    hint: "관리자가 ‘직원관리’에서 해당 직원의 실제 업무에 맞는 업무 역할을 지정해야 합니다. 직급·직책 등록만으로 결재 역할이 배정되지는 않습니다.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["Head approval route unavailable"], code: "SetupRequired",
    message: "휴가를 최종 승인할 Head 역할의 결재자가 설정되지 않았습니다.",
    hint: "권한 관리자가 ‘직원관리’에서 신청자와 다른 활성 직원에게 Head 업무 역할과 휴가 최종 승인 권한을 설정해야 합니다.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["final approval route unavailable"], code: "SetupRequired",
    message: "휴가 최종 결재자가 설정되지 않았습니다.",
    hint: "관리자가 ‘직원관리’에서 신청자와 다른 활성 직원의 Administrative Position 또는 Head 업무 역할과 최종 승인 권한을 확인해야 합니다.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["team and final approval route unavailable"], code: "SetupRequired",
    message: "휴가 신청에 필요한 팀 결재자 또는 최종 결재자가 설정되지 않았습니다.",
    hint: "관리자가 ‘조직관리’에서 소속 팀의 리더를 지정하고 ‘직원관리’에서 팀 승인·최종 승인 역할과 권한을 설정해야 합니다. 신청자 본인과 중복 결재자는 지정할 수 없습니다.",
  },
  {
    databaseCodes: ["P0002"], databaseMessages: ["approval route unavailable", "legacy approval route unavailable"], code: "SetupRequired",
    message: "휴가를 승인할 다른 직원이 설정되지 않았습니다.",
    hint: "관리자가 ‘조직관리’의 팀 리더와 ‘직원관리’의 업무 역할·휴가 승인 권한을 확인해야 합니다. 신청자 본인은 결재자로 사용할 수 없습니다.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["insufficient leave balance"], code: "Conflict",
    message: "잔여 연차가 신청 일수보다 부족해 제출할 수 없습니다.",
    hint: "‘내 휴가’에서 잔여 연차와 신청 일수를 확인해 주세요. 연차가 아직 부여되지 않았거나 잘못된 경우 인사 관리자가 ‘휴가관리’에서 해당 직원의 연차를 부여·조정해야 합니다.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["leave has no working day"], code: "ValidationError",
    message: "선택한 휴가 기간에 근무일이 없습니다.",
    hint: "배정된 근무정책의 근무 요일을 확인하고 근무일이 포함되도록 시작일과 종료일을 변경해 주세요. 근무 요일이 잘못됐다면 인사 관리자에게 정책 변경을 요청해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["half day must be one day"], code: "ValidationError",
    message: "반차는 하루만 신청할 수 있습니다.",
    hint: "오전·오후 반차의 시작일과 종료일을 같은 날짜로 선택해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["invalid date range"], code: "ValidationError",
    message: "종료일이 시작일보다 빠릅니다.",
    hint: "시작일과 종료일을 확인하고 종료일을 시작일 이후로 선택해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["check-in is required"], code: "Conflict",
    message: "출근 기록이 없어 퇴근을 처리할 수 없습니다.",
    hint: "‘내 근태’에서 출근 기록을 먼저 확인해 주세요. 실제 출근 기록이 누락됐다면 인사 관리자에게 ‘근태관리’에서 정정을 요청해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["assigned policy schedules are immutable"], code: "Conflict",
    message: "이미 직원에게 배정된 근무정책의 시간은 직접 변경할 수 없습니다.",
    hint: "‘근무정책’에서 새 정책 버전을 생성하고 변경 적용일을 지정해 직원에게 새 버전을 배정해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["Card is not assigned to this project on transaction date"], code: "SetupRequired",
    message: "해당 거래일에 이 프로젝트로 배정된 법인카드가 아닙니다.",
    hint: "‘법인카드 관리’에서 카드의 프로젝트 배정과 배정 기간을 확인해 주세요. 거래일이 배정 기간에 포함되도록 설정하거나 올바른 카드·프로젝트를 선택해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["No recipients configured"], code: "SetupRequired",
    message: "법인카드 정산 메일의 수신자가 등록되지 않았습니다.",
    hint: "‘월 정산’의 발송 설정에서 수신 이메일을 등록하고 저장한 뒤 다시 발송해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["Automatic email disabled"], code: "SetupRequired",
    message: "법인카드 정산 메일의 자동 발송이 꺼져 있습니다.",
    hint: "자동 발송을 사용하려면 관리자가 ‘월 정산’의 발송 설정에서 자동 발송을 켜고 수신자·발송일시를 저장해야 합니다.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["Excel is required"], code: "SetupRequired",
    message: "발송에 필요한 월 정산 Excel 파일이 아직 생성되지 않았습니다.",
    hint: "‘월 정산’에서 해당 기준월 보고서를 선택하고 ‘Excel 미리 생성’을 실행한 뒤 다시 발송해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["Settlement snapshot is stale; regenerate Excel before closing"], code: "Conflict",
    message: "정산 집계 이후 비용이 변경되어 현재 파일로 마감할 수 없습니다.",
    hint: "‘월 정산’에서 비용을 다시 집계하고 ‘Excel 미리 생성’을 실행한 뒤 마감해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["Project is closed. Reopen it before changing work or finance data.", "Project is closed. Use the reopen command first."], code: "Conflict",
    message: "마감된 프로젝트의 업무·재무 내역은 변경할 수 없습니다.",
    hint: "수정이 필요하면 프로젝트 관리자에게 마감 재개방을 요청한 뒤 다시 저장해 주세요.",
  },
  {
    databaseCodes: ["40001"], databaseMessages: ["allocation exceeds configured limit"], code: "Conflict",
    message: "선택한 기간의 직원 투입률이 회사의 허용 한도를 초과합니다.",
    hint: "‘리소스 계획’에서 같은 기간의 다른 프로젝트 투입을 확인하고 투입률 또는 기간을 조정해 주세요.",
  },
  {
    databaseCodes: ["42501"], databaseMessages: ["Network verification failed", "Network verification expired"], code: "Forbidden",
    message: "회사 네트워크 검증에 실패했거나 검증 시간이 만료됐습니다.",
    hint: "회사 네트워크에 접속한 뒤 ‘내 근태’에서 ‘다시 확인’을 눌러 주세요. 계속 실패하면 관리자가 ‘출퇴근 검증’에서 회사 허용 네트워크 설정을 확인해야 합니다.",
  },
  {
    databaseCodes: ["42501"], databaseMessages: ["Device verification failed", "Device verification expired"], code: "Forbidden",
    message: "회사 PC 인증에 실패했거나 인증 시간이 만료됐습니다.",
    hint: "등록된 회사 PC에서 Device Agent가 실행 중인지 확인한 뒤 ‘내 근태’에서 ‘다시 확인’을 눌러 주세요. 미등록 기기는 관리자에게 등록을 요청해 주세요.",
  },
  {
    databaseCodes: ["42501"], databaseMessages: ["Remote approval required", "Remote approval expired"], code: "Forbidden",
    message: "현재 근무일에 유효한 재택·외근 예외 승인이 없습니다.",
    hint: "인사 관리자에게 ‘출퇴근 검증’에서 해당 근무일의 재택·외근 예외 승인을 요청한 뒤 다시 확인해 주세요.",
  },
  {
    databaseCodes: ["42501"], databaseMessages: ["Attendance verification required", "Attendance verification failed", "Attendance verification already consumed"], code: "Forbidden",
    message: "출퇴근 검증이 완료되지 않았거나 현재 사용할 수 없는 검증입니다.",
    hint: "‘내 근태’에서 ‘다시 확인’을 눌러 회사 PC와 네트워크 검증을 완료한 뒤 출퇴근 기록을 다시 시도해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["Inactive card"], code: "Conflict",
    message: "비활성화된 법인카드는 사용할 수 없습니다.",
    hint: "활성 법인카드를 선택하거나 관리자에게 ‘법인카드 관리’에서 카드 상태 확인을 요청해 주세요.",
  },
  {
    databaseCodes: ["22023"], databaseMessages: ["rejection reason required", "Rejection reason is required"], code: "ValidationError",
    message: "반려 사유를 입력해 주세요.",
    hint: "반려 사유를 2자 이상 입력한 뒤 다시 반려해 주세요.",
  },
];

export function databaseErrorGuidance(code: string, message: string): ErrorGuidance | undefined {
  return rules.find((rule) => rule.databaseCodes.includes(code) && rule.databaseMessages.includes(message));
}
