import { Brand } from "@/components/brand";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="flex h-20 items-center justify-between border-b px-6 md:px-12">
        <Brand />
        <a
          href="https://digital-square.a4942963.chatgpt.site"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 border-b border-foreground pb-1.5 text-xs font-medium"
        >
          회사 홈페이지
          <ArrowUpRight size={14} />
        </a>
      </header>
      <div className="grid flex-1 lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-brand-navy px-16 py-20 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="absolute -right-24 bottom-24 size-96 rotate-12 border border-white/10" />
          <div className="absolute right-0 bottom-40 size-72 rotate-12 border border-[#5583c9]/25" />
          <p className="mb-8 flex items-center gap-2.5 text-[10px] tracking-[.2em] text-white/70">
            <span className="size-1.5 bg-brand-yellow" />
            YOUR DIGITAL WORKSPACE PARTNER
          </p>
          <h1 className="relative text-[39px] leading-[1.45] font-semibold tracking-[-.055em]">
            더 나은 업무의 시작,
            <br />
            <span className="text-[#aec9f2]">하나로 연결된 워크스페이스.</span>
          </h1>
          <p className="mt-7 text-[14px] leading-8 text-[#a8b8cc]">
            사람과 조직을 연결하고, 업무의 흐름을 정리합니다.
            <br />
            디지털스퀘어 통합 업무관리 시스템
          </p>
          <div className="mt-16 flex items-center gap-2 text-[10px] tracking-[.14em] text-white/40">
            <ShieldCheck size={15} />
            DIGITAL SQUARE · INTERNAL ERP
          </div>
        </section>
        <section className="flex items-center justify-center bg-[#fafbfd] px-6 py-16">
          <div className="w-full max-w-[420px] rounded-lg border bg-white p-7 shadow-[0_8px_32px_#182e4e05] sm:p-9">
            {children}
          </div>
        </section>
      </div>
      <footer className="flex h-14 items-center justify-center border-t text-[10px] text-muted-foreground">
        © Digital Square. All rights reserved.
      </footer>
    </main>
  );
}
