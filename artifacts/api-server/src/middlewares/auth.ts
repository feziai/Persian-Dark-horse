import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

export function getAuthenticatedUserId(req: Request): string | undefined {
  return getAuth(req).userId ?? undefined;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication is required." });
    return;
  }
  next();
};