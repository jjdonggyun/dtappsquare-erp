"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Network,
  ShieldCheck,
  FileClock,
  UserRound,
  UserCheck,
  Building2,
  CalendarClock,
  Settings2,
  PlaneTakeoff,
  ClipboardCheck,
  Bell,
  ArrowUpRight,
  ChevronRight,
  LogOut,
  PackageOpen,
  MonitorSmartphone,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  NotebookPen,
  Presentation,
  CreditCard,
  ReceiptText,
} from "lucide-react";
import { navigation } from "@/modules/rbac/domain/policy";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Topbar } from "./topbar";
const icons: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/attendance": CalendarClock,
  "/leave": PlaneTakeoff,
  "/approvals": ClipboardCheck,
  "/notifications": Bell,
  "/assets": PackageOpen,
  "/projects": BriefcaseBusiness,
  "/work-logs": NotebookPen,
  "/weekly-reports": Presentation,
  "/expenses": ReceiptText,
  "/profile": UserRound,
  "/workforce-profiles/me": UserRound,
  "/organizations": Network,
  "/admin/requests": UserCheck,
  "/admin/users": Users,
  "/admin/organizations": Building2,
  "/admin/attendance": CalendarClock,
  "/admin/attendance-verification": ShieldCheck,
  "/admin/work-policies": Settings2,
  "/admin/leave": PlaneTakeoff,
  "/admin/approvals": ClipboardCheck,
  "/admin/assets": PackageOpen,
  "/admin/devices": MonitorSmartphone,
  "/admin/projects": BriefcaseBusiness,
  "/admin/resources": ChartNoAxesCombined,
  "/admin/workforce-profiles": Users,
  "/admin/corporate-cards": CreditCard,
  "/admin/card-settlements": ReceiptText,
  "/admin/roles": ShieldCheck,
  "/admin/settings": Settings2,
  "/admin/audit": FileClock,
};
const sections = [
  {
    name: "내 워크스페이스",
    paths: ["/dashboard", "/attendance", "/leave", "/approvals", "/notifications", "/assets", "/projects", "/profile", "/workforce-profiles/me"],
  },
  { name: "업무관리", paths: ["/work-logs", "/weekly-reports"] },
  {
    name: "조직 · 인사",
    paths: ["/organizations", "/admin/requests", "/admin/users", "/admin/organizations"],
  },
  {
    name: "근태 · 결재",
    paths: ["/admin/attendance", "/admin/attendance-verification", "/admin/work-policies", "/admin/leave", "/admin/approvals"],
  },
  { name: "자산 · 장치", paths: ["/admin/assets", "/admin/devices"] },
  { name: "프로젝트 관리", paths: ["/admin/projects", "/admin/resources", "/admin/workforce-profiles"] },
  { name: "법인카드 · 비용", paths: ["/expenses", "/admin/corporate-cards", "/admin/card-settlements"] },
  { name: "시스템", paths: ["/admin/roles", "/admin/settings", "/admin/audit"] },
];
export function WorkspaceShell({
  permissions,
  name,
  unreadNotifications,
  children,
}: {
  permissions: string[];
  name: string;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only">
        본문으로 이동
      </a>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-brand-navy/30 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[72px] shrink-0 items-center border-b px-6">
          <Brand compact />
        </div>
        <div className="mx-4 mt-5 flex items-center gap-2.5 rounded-md border bg-[#fafbfd] px-3 py-3">
          <span className="flex size-8 items-center justify-center rounded bg-brand-navy text-xs font-bold text-white">
            DS
          </span>
          <div>
            <p className="text-[12px] font-semibold">디지털스퀘어</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">통합 업무관리 시스템</p>
          </div>
        </div>
        <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section) => {
            const visible = navigation.filter(
              (item) =>
                section.paths.includes(item.href) &&
                item.permissions.some((permission) => permissions.includes(permission)),
            );
            return (
              visible.length > 0 && (
                <div key={section.name} className="mb-6">
                  <p className="mb-2 px-3 text-[10px] font-semibold tracking-wide text-[#8b96a5]">
                    {section.name}
                  </p>
                  <div className="space-y-1">
                    {visible.map((item) => {
                      const Icon = icons[item.href];
                      const active = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] ${active ? "bg-brand-soft font-semibold text-primary" : "text-[#5b6778] hover:bg-muted hover:text-foreground"}`}
                        >
                          <Icon size={16} strokeWidth={1.65} />
                          {item.label}
                          {active && <ChevronRight size={13} className="ml-auto" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )
            );
          })}
        </nav>
        <div className="border-t px-5 py-4">
          <a
            href="https://digital-square.a4942963.chatgpt.site"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 flex items-center justify-between text-xs text-muted-foreground"
          >
            회사 홈페이지
            <ArrowUpRight size={13} />
          </a>
          <Button
            variant="ghost"
            size="sm"
            disabled={signingOut}
            className="h-8 w-full justify-start px-0 text-xs text-muted-foreground"
            onClick={async () => {
              setSigningOut(true);
              setError("");
              try {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "signout" }),
                });
                if (r.ok) {
                  router.replace("/login");
                  router.refresh();
                } else {
                  setError("로그아웃하지 못했습니다.");
                  setSigningOut(false);
                }
              } catch {
                setError("연결을 확인해 주세요.");
                setSigningOut(false);
              }
            }}
          >
            <LogOut size={14} />
            {signingOut ? "로그아웃 중…" : "로그아웃"}
          </Button>
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className="lg:ml-[236px]">
        <Topbar
          name={name}
          unreadNotifications={unreadNotifications}
          menuOpen={open}
          onToggle={() => setOpen(!open)}
        />
        <main id="main" className="p-5 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
        <footer className="px-8 py-5 text-[10px] tracking-wide text-[#8b96a5]">
          © Digital Square. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
