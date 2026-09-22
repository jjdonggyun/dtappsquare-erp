export type ErrorCode =
  "Unauthorized" | "Forbidden" | "ValidationError" | "NotFound" | "Conflict" | "InternalError";
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}
export const errorStatus: Record<ErrorCode, number> = {
  Unauthorized: 401,
  Forbidden: 403,
  ValidationError: 400,
  NotFound: 404,
  Conflict: 409,
  InternalError: 500,
};
export function databaseError(error: { code?: string }): AppError {
  const code = error.code ?? "";
  if (code === "28000") return new AppError("Unauthorized");
  if (code === "42501") return new AppError("Forbidden");
  if (code === "P0002") return new AppError("NotFound");
  if (["23505", "40001", "40P01"].includes(code)) return new AppError("Conflict");
  if (code.startsWith("22") || ["23502", "23503", "23514"].includes(code))
    return new AppError("ValidationError");
  return new AppError("InternalError");
}
