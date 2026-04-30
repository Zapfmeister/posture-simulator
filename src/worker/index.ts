import { Hono } from "hono";
import type { HonoEnv } from "./types";
import { accessAuth } from "./middleware/auth";
import { config } from "./routes/config";
import { devices } from "./routes/devices";
import { posture } from "./routes/posture";

const app = new Hono<HonoEnv>();

// Health check (no auth required)
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// Configuration status check (no auth, used by first-run UI)
app.get("/api/status", (c) => {
  const missing: string[] = [];
  const { TEAM_DOMAIN, POLICY_AUD, CF_ACCOUNT_ID, CF_API_TOKEN } = c.env;
  if (!TEAM_DOMAIN || TEAM_DOMAIN.includes("PLACEHOLDER")) missing.push("TEAM_DOMAIN");
  if (!POLICY_AUD || POLICY_AUD === "PLACEHOLDER") missing.push("POLICY_AUD");
  if (!CF_ACCOUNT_ID || CF_ACCOUNT_ID === "PLACEHOLDER") missing.push("CF_ACCOUNT_ID");
  if (!CF_API_TOKEN) missing.push("CF_API_TOKEN");
  return c.json({ configured: missing.length === 0, missing });
});

// All other API routes require Access JWT validation
app.use("/api/*", accessAuth);

// Authenticated user info (called by admin UI)
app.get("/api/me", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({
    email: typeof payload["email"] === "string" ? payload["email"] : null,
    type: payload["type"] ?? null,
  });
});

// Posture scoring (called by CF One Client)
app.route("/api/posture", posture);

// Config CRUD (called by admin UI)
app.route("/api/config", config);

// Device listing (called by admin UI, proxies CF API)
app.route("/api/devices", devices);

export default app;
