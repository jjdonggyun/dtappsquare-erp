import { Check, Clock3, X } from "lucide-react";
import { CommandForm } from "@/components/command-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { approvalStatusLabels } from "@/modules/approval/domain/contracts";
import { leaveTypeLabels } from "@/modules/leave/domain/contracts";

type Inbox = Awaited<
  ReturnType<typeof import("@/modules/approval/infrastructure/repository").approvalInbox>
>;

export function ApprovalList({
  rows,
  accountId,
}: {
  rows: Inbox;
  accountId: string;
}) {
  return (
    <div className="space-y-4">
      {rows.map((request) => {
        const current = request.steps.find(
          (step) => step.step_order === request.current_step_order,
        );
        const canDecide =
          request.status === "PENDING" &&
          current?.status === "PENDING" &&
          current.approver_id === accountId;
        return (
          <Card key={request.id} className="gap-0 py-0">
            <CardHeader className="flex flex-row items-start justify-between border-b px-5 py-4">
              <div>
                <CardTitle className="text-sm">
                  {request.leave
                    ? leaveTypeLabels[
                        request.leave.leave_type as keyof typeof leaveTypeLabels
                      ]
                    : request.request_type}
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {request.requesterName}
                  </span>
                </CardTitle>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {request.leave
                    ? `${request.leave.start_date} – ${request.leave.end_date} · ${request.leave.duration}일`
                    : request.reference_id}
                </p>
              </div>
              <Badge variant="outline">
                {approvalStatusLabels[request.status] ?? request.status}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-5 py-5 xl:grid-cols-[1fr_360px]">
              <div>
                <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
                  결재 경로
                </p>
                <ol className="flex flex-wrap gap-3">
                  {request.steps.map((step) => (
                    <li
                      key={step.id}
                      className={`min-w-36 rounded-md border px-4 py-3 text-xs ${
                        step.step_order === request.current_step_order && request.status === "PENDING"
                          ? "border-primary/40 bg-brand-soft"
                          : "bg-[#fafbfd]"
                      }`}
                    >
                      <p className="text-[10px] text-muted-foreground">
                        {step.step_order}단계 · {step.approver_type}
                      </p>
                      <p className="mt-2 font-semibold">
                        {step.approver_id === accountId ? "나" : "지정 결재자"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {approvalStatusLabels[step.status] ?? step.status}
                      </p>
                    </li>
                  ))}
                </ol>
                {request.leave && (
                  <div className="mt-5 rounded-md bg-muted px-4 py-3 text-xs leading-6 text-muted-foreground">
                    {request.leave.reason}
                  </div>
                )}
              </div>
              {canDecide && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-md border border-[#cfe4d9] bg-[#f6fbf8] p-4">
                    <CommandForm
                      endpoint="/api/leave-approval"
                      action="approval.decide"
                      constants={{
                        id: request.id,
                        version: request.version,
                        decision: "APPROVED",
                      }}
                      fields={[{ name: "comment", label: "승인 의견" }]}
                      submit="승인"
                      columns={1}
                    />
                  </div>
                  <div className="rounded-md border border-[#efd1d1] bg-[#fffafa] p-4">
                    <CommandForm
                      endpoint="/api/leave-approval"
                      action="approval.decide"
                      constants={{
                        id: request.id,
                        version: request.version,
                        decision: "REJECTED",
                      }}
                      fields={[{ name: "comment", label: "반려 의견" }]}
                      submit="반려"
                      columns={1}
                    />
                  </div>
                </div>
              )}
              {!canDecide && (
                <div className="flex items-center gap-2 self-center rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                  {request.status === "APPROVED" ? (
                    <Check size={15} />
                  ) : request.status === "PENDING" ? (
                    <Clock3 size={15} />
                  ) : (
                    <X size={15} />
                  )}
                  {request.status === "PENDING" ? "현재 결재자의 처리를 기다리고 있습니다." : `결재가 ${approvalStatusLabels[request.status]}되었습니다.`}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {!rows.length && (
        <Card>
          <CardContent className="py-16 text-center text-xs text-muted-foreground">
            표시할 결재가 없습니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
