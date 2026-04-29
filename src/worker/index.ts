import { Hono } from "hono";
import type { HonoEnv } from "./types";
import { accessAuth } from "./middleware/auth";
import { config } from "./routes/config";
import { posture } from "./routes/posture";

const app = new Hono<HonoEnv>();

// Health check (no auth required)
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// All other API routes require Access JWT validation
app.use("/api/*", accessAuth);

// Posture scoring (called by CF One Client)
app.route("/api/posture", posture);

// Config CRUD (called by admin UI)
app.route("/api/config", config);

export default app;
