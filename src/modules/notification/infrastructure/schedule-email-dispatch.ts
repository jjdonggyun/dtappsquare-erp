import "server-only";
import { after } from "next/server";
import { dispatchPendingEmails } from "../application/dispatcher";

export function scheduleEmailDispatch(requestId: string) {
  after(async () => {
    try {
      await dispatchPendingEmails(5);
    } catch {
      console.error(JSON.stringify({ requestId, code: "EMAIL_DISPATCH_FAILED" }));
    }
  });
}
