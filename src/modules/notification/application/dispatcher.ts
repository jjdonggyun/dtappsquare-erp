import "server-only";
import { provisioningClient } from "@/shared/infrastructure/supabase/admin";
import { databaseError } from "@/shared/domain/errors";
import { emailProvider } from "../infrastructure/email-providers";
import { EmailProviderError } from "./email-provider";
import {corporateCardEmailAttachment} from "@/modules/corporate-card/application/email-attachment";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

export async function dispatchPendingEmails(limit = 10) {
  const client = provisioningClient();
  const { provider, from } = emailProvider();
  if (provider.name === "DISABLED") return { sent: 0, failed: 0, skipped: true };
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(Math.max(limit, 1), 25); index++) {
    const { data, error } = await client.rpc("claim_notification_outbox");
    if (error) throw databaseError(error);
    const job = data?.[0];
    if (!job) break;
    const payload = job.payload as { title?: unknown; message?: unknown;file_key?:unknown };
    const title = typeof payload.title === "string" ? payload.title : "Digital Square 알림";
    const message = typeof payload.message === "string" ? payload.message : "업무 알림이 도착했습니다.";
    let success = false;
    let providerMessageId: string | null = null;
    let errorCode: string | null = null;
    try {
      let attachments: {filename:string;content:Buffer;contentType:string}[]|undefined;
      if(job.template==="CORPORATE_CARD_SETTLEMENT"||job.template==="CORPORATE_CARD_SETTLEMENT_TEST"){
        if(typeof payload.file_key!=="string"||!job.monthly_card_report_id)throw new EmailProviderError("CONFIGURATION_ERROR");
        attachments=[await corporateCardEmailAttachment(job.monthly_card_report_id,payload.file_key)];
      }
      const delivery = await provider.send(
        {
          from,
          to: job.recipient_email,
          subject: `[Digital Square] ${title}`,
          text: `${title}\n\n${message}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><div style="background:#071c35;color:#fff;padding:20px 24px"><strong>Digital Square</strong></div><div style="padding:28px 24px;border:1px solid #e3e8ef"><h1 style="font-size:20px;color:#192638">${escapeHtml(title)}</h1><p style="font-size:14px;line-height:1.7;color:#5b6778">${escapeHtml(message)}</p></div></div>`,
          attachments,
        },
        job.event_key,
      );
      success = true;
      providerMessageId = delivery.messageId;
      sent++;
    } catch (error) {
      errorCode = error instanceof EmailProviderError ? error.safeCode : "PROVIDER_UNAVAILABLE";
      failed++;
    }
    const completion = await client.rpc("complete_notification_outbox", {
      p_id: job.id,
      p_success: success,
      p_provider: provider.name,
      p_provider_message_id: providerMessageId ?? undefined,
      p_error_code: errorCode ?? undefined,
    });
    if (completion.error) throw databaseError(completion.error);
  }
  return { sent, failed, skipped: false };
}
