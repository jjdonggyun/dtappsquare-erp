"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Home, UserRound, Menu, X } from "lucide-react";
import { navigation } from "@/modules/rbac/domain/policy";
import { Button } from "@/components/ui/button";
export function Topbar({
  name,
  unreadNotifications,
  menuOpen,
  onToggle,
}: {
  name: string;
  unreadNotifications: number;
  menuOpen: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const current =
    navigation.find((item) => item.href === pathname) ??
    navigation.find((item) => pathname.startsWith(item.href + "/"));
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b bg-card px-5 lg:px-8">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Button
          onClick={onToggle}
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
        <Home size={14} className="hidden sm:block" />
        <span className="hidden sm:block">업무관리</span>
        <ChevronRight size={13} className="hidden sm:block" />
        <span className="font-medium text-foreground">{current?.label ?? "직원 상세"}</span>
      </div>
      <div className="flex items-center gap-5">
        <span className="hidden border-r pr-5 text-[11px] tracking-[.1em] text-muted-foreground md:block">
          DIGITAL SQUARE ERP
        </span>
        <Link
          href="/notifications"
          aria-label={`알림, 읽지 않음 ${unreadNotifications}건`}
          className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell size={16} />
          {unreadNotifications > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          ) : null}
        </Link>
        <Link href="/profile" className="flex items-center gap-2.5 text-sm">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-primary">
            <UserRound size={16} />
          </span>
          <span className="font-semibold">
            {name}
            <span className="ml-1 font-normal text-muted-foreground">님</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
