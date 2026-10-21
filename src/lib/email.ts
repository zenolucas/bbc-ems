import "server-only";
import { Resend } from "resend";
import { routeToOutbox, writeOutbox } from "./demo/outbox";
import { env } from "./env";

export type Attachment = { filename: string; content: Buffer; contentType?: string };

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

/**
 * Sends through Resend when RESEND_API_KEY is set, otherwise logs to the
 * console so local development works without an email provider. On the demo
 * deployment it goes to the demo outbox instead (see src/lib/demo/outbox.ts).
 */
export async function sendEmail(input: SendEmailInput) {
  if (await routeToOutbox(input.to)) {
    return writeOutbox({
      kind: "email",
      toAddress: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      meta: input.attachments?.length ? { attachments: input.attachments.map((a) => a.filename) } : null,
    });
  }
  if (!env.resendApiKey) {
    console.log("\n[email:dev] ─────────────────────────────────────────");
    console.log(`[email:dev] to: ${input.to}`);
    console.log(`[email:dev] subject: ${input.subject}`);
    if (input.text) console.log(`[email:dev] text:\n${input.text}`);
    if (input.attachments?.length)
      console.log(`[email:dev] attachments: ${input.attachments.map((a) => a.filename).join(", ")}`);
    console.log("[email:dev] ─────────────────────────────────────────\n");
    return { id: "dev" };
  }
  const resend = new Resend(env.resendApiKey);
  const { data, error } = await resend.emails.send({
    from: env.emailFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return { id: data?.id ?? "" };
}
