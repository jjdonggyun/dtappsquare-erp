import { describe, expect, it } from "vitest";
import {
  activeNavigation,
  breadcrumbsForPath,
  notificationActionPath,
  visibleNavigation,
  visibleQuickActions,
} from "@/modules/navigation/domain/navigation";

describe("typed navigation", () => {
  it("filters navigation and quick actions by permission", () => {
    const permissions = ["PROFILE_READ_SELF", "WORK_LOG_READ_SELF", "WORK_LOG_WRITE_SELF"];
    expect(visibleNavigation(permissions).map((item) => item.href)).toContain("/work-logs");
    expect(visibleNavigation(permissions).map((item) => item.href)).not.toContain("/admin/users");
    expect(visibleQuickActions(permissions).map((item) => item.id)).toEqual(["write-work-log"]);
  });

  it("resolves the longest active route and dynamic breadcrumbs", () => {
    expect(activeNavigation("/finance/billings/00000000-0000-0000-0000-000000000000")?.href).toBe("/finance/billings");
    expect(breadcrumbsForPath("/projects/project-id/documents")).toEqual([
      { label: "프로젝트 관리" },
      { label: "프로젝트", href: "/projects" },
      { label: "문서" },
    ]);
  });

  it("maps supported notification references to safe internal paths", () => {
    expect(notificationActionPath("QUOTATION", "quote-id")).toBe("/quotations/quote-id");
    expect(notificationActionPath("APPROVAL_REQUEST", "approval-id")).toBe("/approvals");
    expect(notificationActionPath("BILLING_SCHEDULE", "schedule-id")).toBe("/finance/billing-schedules");
    expect(notificationActionPath("UNKNOWN", "id")).toBeNull();
  });
});
