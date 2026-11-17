import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/lib/env";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Email adapter. With RESEND_API_KEY set, mail is delivered by Resend.
 * Without it (development), mail is written to .data/outbox and logged.
 * No mail is ever silently reported as sent.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean; provider: string }> {
  if (env.resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.emailFrom || "NEXTGEN GAME STORE <no-reply@example.com>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("[email] Resend rejected the message", response.status, body);
      return { delivered: false, provider: "resend" };
    }
    return { delivered: true, provider: "resend" };
  }

  try {
    const dir = join(process.cwd(), ".data", "outbox");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${Date.now()}-${mail.to.replace(/[^a-z0-9]/gi, "_")}.txt`);
    await writeFile(
      file,
      `To: ${mail.to}\nSubject: ${mail.subject}\nDate: ${new Date().toISOString()}\n\n${mail.text}\n`,
      "utf8",
    );
    console.log(`[email:dev] ${mail.subject} -> ${mail.to}\n${mail.text}`);
    return { delivered: true, provider: "dev-outbox" };
  } catch (error) {
    console.error("[email] failed to write dev outbox", error);
    return { delivered: false, provider: "dev-outbox" };
  }
}
