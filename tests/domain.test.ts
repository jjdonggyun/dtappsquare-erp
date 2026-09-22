import { describe, it, expect } from "vitest";
import { authorize } from "@/modules/rbac/domain/policy";
import { allowedTransitions, type Account } from "@/modules/users/domain/contracts";
import { organizationTree } from "@/modules/organization/domain/tree";
import { executeCommand, commandSchema } from "@/server/management";
import { databaseError } from "@/shared/domain/errors";
import { calculateAttendance, minuteOfDay } from "@/modules/attendance/domain/calculation";
import { buildResourcePlan } from "@/modules/project-resource/domain/planning";
const account: Account = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Employee",
  status: "ACTIVE",
  permissions: ["PROFILE_READ_SELF"],
};
describe("domain authorization and contracts", () => {
  it("rejects anonymous access", () => expect(() => authorize(null)).toThrow("Unauthorized"));
  it.each(["REQUESTED", "REJECTED", "SUSPENDED", "RESIGNED"] as const)(
    "rejects %s even with ADMIN permissions",
    (status) =>
      expect(() =>
        authorize({ ...account, status, permissions: ["USER_WRITE"] }, "USER_WRITE"),
      ).toThrow("Forbidden"),
  );
  it("does not authorize by role name", () =>
    expect(() => authorize({ ...account, permissions: ["ADMIN"] }, "USER_WRITE")).toThrow(
      "Forbidden",
    ));
  it("blocks unauthorized mutation before repository execution", async () => {
    let called = false;
    await expect(
      executeCommand(
        account,
        { action: "role.assign", payload: { id: account.id, role_ids: [account.id] } },
        {
          execute: async () => {
            called = true;
          },
        },
        "request",
      ),
    ).rejects.toThrow("Forbidden");
    expect(called).toBe(false);
  });
  it("rejects metadata-like privilege injection", () =>
    expect(
      commandSchema.safeParse({
        action: "profile.update",
        payload: { version: 1, user_status: "ACTIVE" },
      }).success,
    ).toBe(false));
  it("requires an explicit rehire workflow", () =>
    expect(allowedTransitions("RESIGNED")).toEqual([]));
  it("does not reveal database internals", () =>
    expect(databaseError({ code: "XX000" }).message).toBe("InternalError"));
  it("builds ordered hierarchy and rejects cycles", () => {
    const root = {
      id: "a",
      name: "root",
      organization_type: "COMPANY",
      parent_id: null,
      leader_user_id: null,
      sort_order: 0,
      active: true,
    };
    const child = { ...root, id: "b", name: "child", parent_id: "a" };
    expect(organizationTree([child, root])[0].children[0].id).toBe("b");
    expect(() => organizationTree([{ ...root, parent_id: "b" }, child])).toThrow("cycle");
  });
  it("applies the grace boundary without hard-coded policy values", () => {
    const policy = {
      checkInMinute: minuteOfDay("09:00"),
      checkOutMinute: minuteOfDay("18:00"),
      breakStartMinute: minuteOfDay("12:00"),
      breakEndMinute: minuteOfDay("13:00"),
      lateGraceMinutes: 5,
    };
    expect(calculateAttendance(policy, minuteOfDay("09:05")).status).toBe("NORMAL");
    expect(calculateAttendance(policy, minuteOfDay("09:06")).status).toBe("LATE");
    expect(
      calculateAttendance(policy, minuteOfDay("09:00"), minuteOfDay("18:00")).workedMinutes,
    ).toBe(480);
  });
  it("classifies overlapping project allocation without blocking the plan", () => {
    const plan = buildResourcePlan(
      [{ id: "u1", name: "User", organization_id: null, position_id: null }],
      [
        { id: "p1", project_name: "A", planned_end_date: "2026-12-31", status: "IN_PROGRESS" },
        { id: "p2", project_name: "B", planned_end_date: "2026-12-31", status: "IN_PROGRESS" },
      ],
      [
        { id: "a1", project_id: "p1", user_id: "u1", planned_start_date: "2026-01-01", planned_end_date: "2026-12-31", allocation_rate: 60, status: "IN_PROGRESS" },
        { id: "a2", project_id: "p2", user_id: "u1", planned_start_date: "2026-06-01", planned_end_date: "2026-12-31", allocation_rate: 50, status: "IN_PROGRESS" },
      ],
      "2026-09-13",
    );
    expect(plan[0]).toMatchObject({ currentAllocation: 110, state: "OVER_ALLOCATED" });
  });
});
