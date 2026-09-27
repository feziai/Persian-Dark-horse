import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAdmin } from "./fezi-data";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const inboxId = "support@persiandarkhorse.com";
const messageBase = `/v0/inboxes/${encodeURIComponent(inboxId)}/messages`;

router.use("/admin/support/inbox", (req, res, next) => {
  if (!requireAdmin(req, res)) return;
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

router.get("/admin/support/inbox", async (req, res): Promise<void> => {
  const pageToken = req.query.pageToken;
  if (pageToken !== undefined && (typeof pageToken !== "string" || pageToken.length > 2048)) {
    res.status(400).json({ error: "Invalid page token." });
    return;
  }
  try {
    const query = new URLSearchParams({ limit: "20", labels: "received" });
    if (pageToken) query.set("page_token", pageToken);
    const response = await connectors.proxy("agentmail", `${messageBase}?${query}`, { method: "GET" });
    if (response.status === 404) {
      res.status(503).json({ error: "The Support mailbox is not ready yet.", setupRequired: true });
      return;
    }
    if (!response.ok) {
      req.log.warn({ status: response.status }, "Support inbox list rejected by provider");
      res.status(503).json({ error: "The Support mailbox could not be loaded." });
      return;
    }
    const payload = await response.json() as {
      messages?: Array<{ message_id?: string; from?: string; subject?: string; preview?: string; timestamp?: string; labels?: string[] }>;
      next_page_token?: string;
    };
    if (!Array.isArray(payload.messages)) throw new Error("Invalid inbox response");
    res.json({
      messages: payload.messages.map((message) => ({
        id: message.message_id,
        from: message.from,
        subject: message.subject || "",
        preview: message.preview || "",
        receivedAt: message.timestamp,
        unread: message.labels?.includes("unread") ?? false,
      })),
      nextPageToken: payload.next_page_token || null,
    });
  } catch (error) {
    req.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Support inbox list unavailable");
    res.status(503).json({ error: "The Support mailbox could not be loaded." });
  }
});

router.get("/admin/support/inbox/:messageId", async (req, res): Promise<void> => {
  const messageId = req.params.messageId;
  if (typeof messageId !== "string" || !messageId || messageId.length > 512) {
    res.status(400).json({ error: "Invalid message ID." });
    return;
  }
  try {
    const response = await connectors.proxy("agentmail", `${messageBase}/${encodeURIComponent(messageId)}`, { method: "GET" });
    if (response.status === 404) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    if (!response.ok) {
      req.log.warn({ status: response.status }, "Support inbox message rejected by provider");
      res.status(503).json({ error: "The message could not be loaded." });
      return;
    }
    const message = await response.json() as {
      inbox_id?: string; message_id?: string; from?: string; to?: string[]; subject?: string;
      timestamp?: string; text?: string; extracted_text?: string; labels?: string[];
      attachments?: Array<{ filename?: string; size?: number }>;
    };
    if (message.inbox_id?.toLowerCase() !== inboxId || message.message_id !== messageId || !message.labels?.includes("received")) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    res.json({
      message: {
        id: message.message_id,
        from: message.from || "",
        to: message.to || [],
        subject: message.subject || "",
        receivedAt: message.timestamp,
        text: message.text || message.extracted_text || "",
        attachments: (message.attachments || []).map(({ filename, size }) => ({ filename: filename || "Attachment", size: size || 0 })),
      },
    });
  } catch (error) {
    req.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Support inbox message unavailable");
    res.status(503).json({ error: "The message could not be loaded." });
  }
});

export default router;