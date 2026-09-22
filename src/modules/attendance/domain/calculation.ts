export type AttendanceStatus =
  | "NORMAL"
  | "LATE"
  | "ABSENT"
  | "EARLY_LEAVE"
  | "VACATION"
  | "HALF_DAY"
  | "REMOTE"
  | "BUSINESS_TRIP";

export type TimePolicy = {
  checkInMinute: number;
  checkOutMinute: number;
  breakStartMinute?: number;
  breakEndMinute?: number;
  lateGraceMinutes: number;
};

export type AttendanceCalculation = {
  status: AttendanceStatus;
  flags: AttendanceStatus[];
  workedMinutes: number;
};

/** Pure domain calculation. Values are minutes on one normalized work-day timeline. */
export function calculateAttendance(
  policy: TimePolicy,
  checkInMinute?: number,
  checkOutMinute?: number,
): AttendanceCalculation {
  if (checkInMinute === undefined) return { status: "ABSENT", flags: ["ABSENT"], workedMinutes: 0 };
  if (checkOutMinute !== undefined && checkOutMinute < checkInMinute)
    throw new Error("check-out precedes check-in");

  const flags: AttendanceStatus[] = [];
  // Seconds through 09:05:59 are normalized into minute 545 and remain within a five-minute grace.
  if (checkInMinute >= policy.checkInMinute + policy.lateGraceMinutes + 1) flags.push("LATE");
  if (checkOutMinute !== undefined && checkOutMinute < policy.checkOutMinute)
    flags.push("EARLY_LEAVE");

  let workedMinutes = checkOutMinute === undefined ? 0 : checkOutMinute - checkInMinute;
  if (
    checkOutMinute !== undefined &&
    policy.breakStartMinute !== undefined &&
    policy.breakEndMinute !== undefined
  ) {
    const overlap = Math.max(
      0,
      Math.min(checkOutMinute, policy.breakEndMinute) -
        Math.max(checkInMinute, policy.breakStartMinute),
    );
    workedMinutes -= overlap;
  }

  return {
    status: flags.includes("LATE")
      ? "LATE"
      : flags.includes("EARLY_LEAVE")
        ? "EARLY_LEAVE"
        : "NORMAL",
    flags,
    workedMinutes: Math.max(0, workedMinutes),
  };
}

export function minuteOfDay(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    throw new Error("invalid time");
  return hour * 60 + minute;
}
