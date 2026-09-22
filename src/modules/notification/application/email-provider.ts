export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  attachments?: {filename:string;content:Buffer;contentType:string}[];
};

export type EmailDelivery = { messageId: string | null };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage, idempotencyKey: string): Promise<EmailDelivery>;
}

export class EmailProviderError extends Error {
  constructor(public readonly safeCode: "CONFIGURATION_ERROR" | "PROVIDER_REJECTED" | "PROVIDER_UNAVAILABLE") {
    super(safeCode);
  }
}
