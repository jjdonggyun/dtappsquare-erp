import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
} from "../application/email-provider";

const emailConfigSchema = z.object({
  EMAIL_PROVIDER: z.enum(["DISABLED", "RESEND", "SMTP"]).default("DISABLED"),
  EMAIL_FROM: z.string().min(3).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

class DisabledProvider implements EmailProvider {
  readonly name = "DISABLED";
  async send(...args: Parameters<EmailProvider["send"]>): Promise<never> {
    void args;
    throw new EmailProviderError("CONFIGURATION_ERROR");
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "RESEND";
  constructor(private readonly apiKey: string) {}
  async send(message: EmailMessage, idempotencyKey: string) {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.attachments?.length ? { attachments: message.attachments.map(item=>({filename:item.filename,content:item.content.toString("base64")})) } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new EmailProviderError("PROVIDER_UNAVAILABLE");
    }
    if (!response.ok) throw new EmailProviderError("PROVIDER_REJECTED");
    const data = (await response.json()) as { id?: string };
    return { messageId: data.id ?? null };
  }
}

class SmtpProvider implements EmailProvider {
  readonly name = "SMTP";
  private readonly transport;
  constructor(options: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
  }) {
    this.transport = nodemailer.createTransport({
      pool: true,
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  async send(message: EmailMessage, idempotencyKey: string) {
    try {
      const result = await this.transport.sendMail({
        ...message,
        headers: { "X-ERP-Idempotency-Key": idempotencyKey },
      });
      return { messageId: result.messageId || null };
    } catch {
      throw new EmailProviderError("PROVIDER_UNAVAILABLE");
    }
  }
}

export function emailProvider(): { provider: EmailProvider; from: string } {
  const config = emailConfigSchema.parse(process.env);
  if (config.EMAIL_PROVIDER === "RESEND") {
    if (!config.RESEND_API_KEY || !config.EMAIL_FROM)
      throw new EmailProviderError("CONFIGURATION_ERROR");
    return { provider: new ResendProvider(config.RESEND_API_KEY), from: config.EMAIL_FROM };
  }
  if (config.EMAIL_PROVIDER === "SMTP") {
    if (!config.SMTP_HOST || !config.EMAIL_FROM || Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD))
      throw new EmailProviderError("CONFIGURATION_ERROR");
    return {
      provider: new SmtpProvider({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE === "true",
        user: config.SMTP_USER,
        password: config.SMTP_PASSWORD,
      }),
      from: config.EMAIL_FROM,
    };
  }
  return { provider: new DisabledProvider(), from: config.EMAIL_FROM ?? "disabled@localhost" };
}
