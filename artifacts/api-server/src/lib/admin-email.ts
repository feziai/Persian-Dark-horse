import { ReplitConnectors } from "@replit/connectors-sdk";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const connectors = new ReplitConnectors();
let flushing = false;
let flushRequested = false;
let retryTimer: NodeJS.Timeout | undefined;

async function flushAdminEmails() {
  if (!process.env.ADMIN_ALERT_TO_EMAIL || !process.env.ADMIN_ALERT_FROM_EMAIL) return;
  if (flushing) {
    flushRequested = true;
    return;
  }
  flushing = true;
  try {
    for (let i = 0; i < 10; i++) {
      const { rows } = await pool.query<{
        event_key: string; subject: string; body: string; attempts: number;
      }>(`
        UPDATE admin_email_outbox o SET
          attempts = o.attempts + 1,
          next_attempt_at = now() + interval '2 minutes'
        FROM (
          SELECT event_key FROM admin_email_outbox
          WHERE sent_at IS NULL AND next_attempt_at <= now() AND attempts < 20
          ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
        ) candidate
        WHERE o.event_key = candidate.event_key
        RETURNING o.event_key, o.subject, o.body, o.attempts
      `);
      const event = rows[0];
      if (!event) break;
      try {
        const response = await connectors.proxy("resend", "/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": event.event_key,
          },
          body: {
            from: process.env.ADMIN_ALERT_FROM_EMAIL,
            to: [process.env.ADMIN_ALERT_TO_EMAIL],
            subject: event.subject,
            text: event.body,
          },
        });
        if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
        await pool.query("UPDATE admin_email_outbox SET sent_at=now() WHERE event_key=$1", [event.event_key]);
      } catch (error) {
        const delay = Math.min(3600, 30 * 2 ** Math.min(event.attempts, 7));
        await pool.query(
          "UPDATE admin_email_outbox SET next_attempt_at=now()+($2::int * interval '1 second') WHERE event_key=$1",
          [event.event_key, delay],
        );
        logger.warn({ eventKey: event.event_key, errorType: error instanceof Error ? error.name : "unknown" }, "Admin email delivery failed; will retry");
      }
    }
  } catch (error) {
    logger.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Admin email outbox unavailable");
  } finally {
    flushing = false;
    if (flushRequested) {
      flushRequested = false;
      void flushAdminEmails();
    }
  }
}

export async function queueAdminEmail(eventKey: string, subject: string, body: string) {
  if (!process.env.ADMIN_ALERT_TO_EMAIL || !process.env.ADMIN_ALERT_FROM_EMAIL) {
    logger.warn("Admin email configuration is missing");
    return;
  }
  try {
    await pool.query(
      `INSERT INTO admin_email_outbox(event_key,subject,body) VALUES($1,$2,$3)
       ON CONFLICT(event_key) DO NOTHING`,
      [eventKey, subject, body],
    );
    if (!retryTimer) {
      retryTimer = setInterval(() => { void flushAdminEmails(); }, 30_000);
      retryTimer.unref();
    }
    await flushAdminEmails();
  } catch (error) {
    logger.error({ eventKey, errorType: error instanceof Error ? error.name : "unknown" }, "Could not queue admin email");
  }
}

// Resume unsent notifications after an API restart, even if no new events occur.
if (process.env.ADMIN_ALERT_TO_EMAIL && process.env.ADMIN_ALERT_FROM_EMAIL) {
  retryTimer = setInterval(() => { void flushAdminEmails(); }, 30_000);
  retryTimer.unref();
}