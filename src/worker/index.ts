import { Hono } from "hono";
import type { Env } from "./types";

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
