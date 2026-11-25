"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight, Bell, BriefcaseBusiness, Building2, CalendarClock, CalendarRange,
  ChartNoAxesCombined, ChevronRight, CircleDollarSign, ClipboardCheck, ContactRound,
  CreditCard, FileClock, FileSignature, FileText, Landmark, LayoutDashboard, LogOut,
  MonitorSmartphone, Network, NotebookPen, PackageOpen, PlaneTakeoff, Presentation,
  Receipt, ReceiptText, Settings2, ShieldCheck, Target, UserCheck, UserRound, Users,
} from "lucide-react";
import {
  activeNavigation,
  navigationSections,
  visibleNavigation,
  type NavigationIcon,
} from "@/modules/navigation/domain/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Topbar } from "./topbar";

const icons: Record<NavigationIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  attendance: CalendarClock,
  leave: PlaneTakeoff,
  approval: ClipboardCheck,
  notification: Bell,
  asset: PackageOpen,
  project: BriefcaseBusiness,
  workLog: NotebookPen,
  report: Presentation,
  expense: ReceiptText,
  vendor: Building2,
  customer: ContactRound,
  opportunity: Target,
  quotation: FileText,
  contract: FileSignature,
  billingSchedule: CalendarRange,
  billing: CircleDollarSign,
  taxInvoice: Receipt,
  payment: Landmark,
  profit: ChartNoAxesCombined,
  settings: Settings2,
  profile: UserRound,
  organization: Network,
  request: UserCheck,
  users: Users,
  verification: ShieldCheck,
  device: MonitorSmartphone,
  card: CreditCard,
  audit: FileClock,
};

export function WorkspaceShell({
  permissions,
  roles,
  name,
  unreadNotifications,
  children,
}: {
  permissions: string[];
  roles: string[];
  name: string;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = visibleNavigation(permissions);
  const activeSection = activeNavigation(pathname)?.section ?? "workspace";

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only">본문으로 이동</a>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-brand-navy/30 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] shrink-0 items-center border-b px-6"><Brand compact /></div>
        <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-3">
          {navigationSections.map((section) => {
            const items = visibleItems.filter((item) => item.section === section.id);
            if (items.length === 0) return null;
            return (
              <details key={section.id} open={section.id === activeSection} className="group mb-2">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 text-[11px] font-semibold tracking-wide text-[#5b6778] transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {section.label}
                  <ChevronRight size={14} aria-hidden="true" className="transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-1 space-y-1 pl-1">
                  {items.map((item) => {
                    const Icon = icons[item.icon];
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-[13px] ${active ? "bg-brand-soft font-semibold text-primary" : "text-[#5b6778] hover:bg-muted hover:text-foreground"}`}
                      >
                        <Icon size={16} strokeWidth={1.65} />
                        {item.id === "dashboard" && roles.includes("HEAD") ? "Executive Dashboard" : item.label}
                        {active && <ChevronRight size={13} className="ml-auto" />}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </nav>
        <div className="border-t px-5 py-4">
          <a href="https://dtappsquare.vercel.app" target="_blank" rel="noopener noreferrer" className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
            회사 홈페이지 <ArrowUpRight size={13} />
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
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "signout" }),
                });
                if (response.ok) {
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
          {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
        </div>
      </aside>
      <div className="lg:ml-[236px]">
        <Topbar
          name={name}
          permissions={permissions}
          unreadNotifications={unreadNotifications}
          menuOpen={open}
          onToggle={() => setOpen(!open)}
        />
        <main id="main" className="p-5 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
        <footer className="px-8 py-5 text-[10px] tracking-wide text-[#8b96a5]">© Digital Square. All rights reserved.</footer>
      </div>
    </div>
  );
}
