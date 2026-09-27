import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAdmin } from "./fezi-data";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const sendTimes: number[] = [];

router.get("/admin/mail/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  if (query.length > 100) {
    res.status(400).json({ error: "Search is too long." });
    return;
  }
  try {
    const result = await clerkClient.users.getUserList({ limit: 30, ...(query ? { query } : {}) });
    res.json({
      users: result.data.map((user) => ({
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "",
        email: user.primaryEmailAddress?.emailAddress ?? null,
        verified: user.primaryEmailAddress?.verification?.status === "verified",
      })),
    });
  } catch {
    res.status(503).json({ error: "Could not load users right now." });
  }
});

router.post("/admin/mail/send", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { userId, subject, message } = req.body ?? {};
  if (typeof userId !== "string" || !/^user_[A-Za-z0-9]{10,80}$/.test(userId)
    || typeof subject !== "string" || !subject.trim() || subject.length > 200
    || typeof message !== "string" || !message.trim() || message.length > 20000) {
    res.status(400).json({ error: "Choose a user and enter a subject and message." });
    return;
  }
  if (!process.env.ADMIN_ALERT_FROM_EMAIL) {
    res.status(503).json({ error: "The email sender is not configured." });
    return;
  }
  const now = Date.now();
  while (sendTimes[0] && sendTimes[0] < now - 60 * 60 * 1000) sendTimes.shift();
  if (sendTimes.length >= 30) {
    res.status(429).json({ error: "Hourly email limit reached. Try again later." });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress;
    if (!email || email.verification?.status !== "verified") {
      res.status(400).json({ error: "This user does not have a verified email address." });
      return;
    }
    sendTimes.push(now);
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: {
        from: process.env.ADMIN_ALERT_FROM_EMAIL,
        to: [email.emailAddress],
        subject: subject.trim(),
        text: message.trim(),
      },
    });
    if (!response.ok) {
      req.log.warn({ status: response.status }, "Admin user email rejected by provider");
      res.status(502).json({ error: "Email provider rejected the message. Please try again later." });
      return;
    }
    req.log.info({ userId }, "Admin user email accepted by provider");
    res.json({ sent: true });
  } catch {
    res.status(503).json({ error: "Could not send email right now. Check the recipient and try again." });
  }
});

export default router;