export const attendanceStatusLabels: Record<string, string> = {
  NORMAL: "정상",
  LATE: "지각",
  ABSENT: "결근",
  EARLY_LEAVE: "조퇴",
  VACATION: "휴가",
  HALF_DAY: "반차",
  REMOTE: "재택",
  BUSINESS_TRIP: "출장",
};

export function attendanceBadgeClass(status?: string | null) {
  if (status === "NORMAL") return "border-0 bg-[#ecf7f2] text-[#287454]";
  if (status === "LATE" || status === "EARLY_LEAVE") return "border-0 bg-[#fff6dd] text-[#9d7012]";
  if (status === "ABSENT") return "border-0 bg-[#fff0f0] text-[#b33b3b]";
  return "border-0 bg-muted text-muted-foreground";
}
