import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
const parseMcpJson = express.json({ limit: "64kb", strict: true });
app.use("/api/mcp", (req, res, next) => {
  parseMcpJson(req, res, (error?: unknown) => {
    if (error) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;
      const tooLarge = status === 413;
      res.status(tooLarge ? 413 : 400).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: tooLarge ? -32000 : -32700,
          message: tooLarge ? "MCP request body exceeds the 64 KB limit." : "MCP request body must contain valid JSON.",
        },
      });
      return;
    }
    next();
  });
});
app.use(express.json({ limit: "15mb" }));
const parseRawImages = express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "9mb" });
app.use((req, res, next) => {
  // Chat uploads stream their own body; express.raw would consume PNG/JPEG/WebP first.
  if (req.path === "/api/files/analyze-upload") return next();
  parseRawImages(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
