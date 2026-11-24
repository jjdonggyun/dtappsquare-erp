"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, Home, Menu, Plus, Search, UserRound, X } from "lucide-react";
import { breadcrumbsForPath, visibleQuickActions } from "@/modules/navigation/domain/navigation";
import { Button } from "@/components/ui/button";

export function Topbar({
  name,
  permissions,
  unreadNotifications,
  menuOpen,
  onToggle,
}: {
  name: string;
  permissions: string[];
  unreadNotifications: number;
  menuOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const breadcrumbs = breadcrumbsForPath(pathname);
  const actions = visibleQuickActions(permissions);

  return (
    <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b bg-card px-5 py-3 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button onClick={onToggle} variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={menuOpen}>
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
        <nav aria-label="현재 위치" className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Link href="/dashboard" aria-label="대시보드" className="hidden hover:text-foreground sm:block"><Home size={14} /></Link>
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="contents">
              <ChevronRight size={13} className="hidden shrink-0 sm:block" />
              {crumb.href ? (
                <Link href={crumb.href} className="hidden truncate hover:text-foreground sm:block">{crumb.label}</Link>
              ) : (
                <span className="truncate font-medium text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-3">
        <form action="/search" method="get" role="search" className="relative hidden xl:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input name="q" type="search" minLength={2} maxLength={80} aria-label="통합 검색" placeholder="고객, 프로젝트, 문서 검색" className="h-9 w-64 rounded-md border bg-background pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
        </form>
        <Link href="/search" aria-label="통합 검색" className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden"><Search size={17} /></Link>
        {actions.length > 0 ? (
          <div className="relative" onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuickActionsOpen(false);
              event.currentTarget.querySelector("button")?.focus();
            }
          }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={quickActionsOpen}
              onClick={() => setQuickActionsOpen((open) => !open)}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <Plus size={15} /><span className="hidden sm:inline">빠른 실행</span><ChevronDown size={13} className={`transition-transform ${quickActionsOpen ? "rotate-180" : ""}`} />
            </button>
            {quickActionsOpen ? <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg">
              <p className="px-2 py-1.5 text-[10px] font-semibold tracking-[.12em] text-muted-foreground">QUICK ACTION</p>
              {actions.map((action) => (
                <Link key={action.id} href={action.href} role="menuitem" onClick={() => setQuickActionsOpen(false)} className="block rounded-md px-3 py-2.5 hover:bg-muted">
                  <span className="block text-xs font-semibold">{action.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{action.description}</span>
                </Link>
              ))}
            </div> : null}
          </div>
        ) : null}
        <Link href="/notifications" aria-label={`알림, 읽지 않음 ${unreadNotifications}건`} className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <Bell size={16} />
          {unreadNotifications > 0 ? <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span> : null}
        </Link>
        <Link href="/profile" aria-label={`${name} 프로필`} className="flex items-center gap-2.5 text-sm">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-primary"><UserRound size={16} /></span>
          <span className="hidden font-semibold md:inline">{name}<span className="ml-1 font-normal text-muted-foreground">님</span></span>
        </Link>
      </div>
    </header>
  );
}
