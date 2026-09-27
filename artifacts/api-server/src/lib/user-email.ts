import { clerkClient } from "@clerk/express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const connectors = new ReplitConnectors();
const from = () => process.env.TRANSACTIONAL_FROM_EMAIL || "Support@persiandarkhorse.com";
const replyTo = () => process.env.TRANSACTIONAL_REPLY_TO_EMAIL || "PersianDarkHorsesup@gmail.com";
let flushing = false;

export type PurchaseStatus = "pending" | "approved" | "rejected";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export function validEmailContact(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>,;:"()]+@[^\s@<>,;:"()]+\.[^\s@<>,;:"()]+$/u.test(value);
}

export function purchaseMail(status: PurchaseStatus, paymentId: string) {
  const messages = {
    pending: ["درخواست پرداخت ثبت شد | Payment under review", "درخواست پرداخت شما ثبت شده و در انتظار بررسی است. پرداخت هنوز تأیید نشده و دسترسی خرید فعال نشده است.\nYour payment was submitted for review. It has NOT been approved and your purchase is not active yet."],
    approved: ["پرداخت تأیید شد | Payment approved", "پرداخت شما تأیید شد و خریدتان فعال شده است.\nYour payment was approved and your purchase is now active."],
    rejected: ["پرداخت رد شد | Payment rejected", "پرداخت شما تأیید نشد و خریدتان فعال نشده است. برای پیگیری با پشتیبانی تماس بگیرید.\nYour payment was not approved and your purchase has not been activated. Please contact support if you need help."],
  } as const;
  const [subject, body] = messages[status];
  return { subject, body: `${body}\n\nشناسه پرداخت / Payment ID: ${paymentId}\nپشتیبانی / Support: ${replyTo()}` };
}

export function ticketMail(status: TicketStatus, ticketId: string) {
  const messages = {
    open: ["درخواست پشتیبانی باز شد | Support ticket reopened", "وضعیت درخواست پشتیبانی شما به «باز» تغییر کرد.\nYour support ticket is now open."],
    in_progress: ["درخواست پشتیبانی در حال بررسی است | Support ticket in progress", "درخواست پشتیبانی شما در حال بررسی است.\nYour support ticket is in progress."],
    resolved: ["درخواست پشتیبانی رسیدگی شد | Support ticket resolved", "درخواست پشتیبانی شما رسیدگی شد.\nYour support ticket has been resolved."],
    closed: ["درخواست پشتیبانی بسته شد | Support ticket closed", "درخواست پشتیبانی شما بسته شد.\nYour support ticket has been closed."],
  } as const;
  const [subject, body] = messages[status];
  return { subject, body: `${body}\n\nشناسه درخواست / Ticket ID: ${ticketId}\nپشتیبانی / Support: ${replyTo()}` };
}

const welcome = {
  subject: "به Persian Dark Horse خوش آمدید | Welcome",
  body: "به Persian Dark Horse خوش آمدید! حساب شما آماده است.\nWelcome to Persian Dark Horse! Your account is ready.",
};

async function insert(eventKey: string, userId: string | null, recipient: string | null, kind: string, subject: string, body: string) {
  try {
    await pool.query(
      `INSERT INTO user_email_outbox(event_key,user_id,recipient,kind,subject,body)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING`,
      [eventKey, userId, recipient, kind, subject, body],
    );
    void flushUserEmails();
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Could not persist user email event");
  }
}

export function queueWelcome(userId: string) {
  return insert(`user:welcome:${userId}`, userId, null, "welcome", welcome.subject, `${welcome.body}\n\nپشتیبانی / Support: ${replyTo()}`);
}

export function queuePurchaseEmail(paymentId: string, userId: string, status: PurchaseStatus) {
  const { subject, body } = purchaseMail(status, paymentId);
  return insert(`user:payment:${status}:${paymentId}`, userId, null, "purchase", subject, body);
}

export function queueTicketStatusEmail(ticketId: string, transitionAt: Date, contact: string, status: TicketStatus) {
  if (!validEmailContact(contact)) return Promise.resolve();
  const { subject, body } = ticketMail(status, ticketId);
  return insert(`user:ticket:${ticketId}:${transitionAt.toISOString()}`, null, contact, "ticket", subject, body);
}

export async function flushUserEmails() {
  if (flushing) return;
  flushing = true;
  try {
    for (let i = 0; i < 10; i++) {
      const { rows } = await pool.query<{
        event_key: string; user_id: string | null; recipient: string | null;
        kind: string; subject: string; body: string; attempts: number; created_at: Date;
      }>(`
        UPDATE user_email_outbox o SET attempts=o.attempts+1, next_attempt_at=now()+interval '2 minutes'
        FROM (
          SELECT event_key FROM user_email_outbox
          WHERE sent_at IS NULL AND skipped_at IS NULL AND next_attempt_at<=now() AND attempts<20
          ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
        ) candidate
        WHERE o.event_key=candidate.event_key
        RETURNING o.event_key,o.user_id,o.recipient,o.kind,o.subject,o.body,o.attempts,o.created_at
      `);
      const event = rows[0];
      if (!event) break;
      try {
        let recipient = event.recipient;
        if (event.user_id && !recipient) {
          const user = await clerkClient.users.getUser(event.user_id);
          if (event.kind === "welcome") {
            const age = event.created_at.getTime() - user.createdAt;
            if (age < 0 || age >= 30 * 60_000) {
              await pool.query("UPDATE user_email_outbox SET skipped_at=now() WHERE event_key=$1", [event.event_key]);
              continue;
            }
          }
          const email = user.primaryEmailAddress;
          // A user may verify an address later; do not deliver to an unverified or secondary address.
          if (!email || email.verification?.status !== "verified" || !validEmailContact(email.emailAddress)) {
            throw new Error("RecipientNotVerified");
          }
          recipient = email.emailAddress;
          // Freeze the verified primary recipient before the first provider call. A retry
          // must use the same payload with the same idempotency key even if Clerk changes.
          await pool.query(
            "UPDATE user_email_outbox SET recipient=$2 WHERE event_key=$1 AND recipient IS NULL",
            [event.event_key, recipient],
          );
        }
        if (!recipient || !validEmailContact(recipient)) throw new Error("InvalidRecipient");
        const response = await connectors.proxy("resend", "/emails", {
          method: "POST",
          // Previously queued rows (if any) also get a namespaced provider key.
          headers: { "Content-Type": "application/json", "Idempotency-Key": event.event_key.startsWith("user:") ? event.event_key : `user:${event.event_key}` },
          body: { from: from(), to: [recipient], reply_to: replyTo(), subject: event.subject, text: event.body },
        });
        if (!response.ok) throw new Error("ProviderError");
        await pool.query("UPDATE user_email_outbox SET sent_at=now() WHERE event_key=$1", [event.event_key]);
      } catch (error) {
        const delay = Math.min(3600, 30 * 2 ** Math.min(event.attempts, 7));
        await pool.query(
          "UPDATE user_email_outbox SET next_attempt_at=now()+($2::int * interval '1 second') WHERE event_key=$1",
          [event.event_key, delay],
        );
        logger.warn({ errorType: error instanceof Error ? error.name : "unknown" }, "User email delivery deferred");
      }
    }
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "User email outbox unavailable");
  } finally {
    flushing = false;
  }
}

// Recover persisted messages across process restarts, including failed Clerk lookups.
const retryTimer = setInterval(() => { void flushUserEmails(); }, 30_000);
retryTimer.unref();