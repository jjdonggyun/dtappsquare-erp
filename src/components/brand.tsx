import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="Digital Square 대시보드"
      className="inline-flex items-center gap-2.5 whitespace-nowrap text-[#101820]"
    >
      <svg viewBox="0 0 32 38" width="29" height="34" aria-hidden="true">
        <path fill="#ffd629" d="M10 15h21v22H10z" />
        <path fill="#111820" d="M2 2h18v7h7v16H9v-8H2z" />
        <path fill="white" d="M8 8h6v6H8zm8 8h6v5h-6z" />
      </svg>
      <span
        className={
          compact
            ? "text-[18px] font-extrabold tracking-[-.055em]"
            : "text-[23px] font-extrabold tracking-[-.055em]"
        }
      >
        Digital Square
      </span>
    </Link>
  );
}
