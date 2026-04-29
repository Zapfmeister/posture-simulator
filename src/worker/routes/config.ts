import { Hono } from "hono";
import type { HonoEnv, PostureConfig } from "../types";

const DEFAULT_CONFIG: PostureConfig = {
  devices: {},
  default_score: 50,
};

const config = new Hono<HonoEnv>();

config.get("/", async (c) => {
  const raw = await c.env.POSTURE_KV.get("config", "text");
  if (!raw) {
    return c.json(DEFAULT_CONFIG);
  }

  try {
    const parsed: PostureConfig = JSON.parse(raw);
    return c.json(parsed);
  } catch {
    console.error("Corrupt config in KV, returning default");
    return c.json(DEFAULT_CONFIG);
  }
});

config.put("/", async (c) => {
  const body = await c.req.json<PostureConfig>();

  // Validate structure
  if (typeof body.default_score !== "number" || body.default_score < 0 || body.default_score > 100) {
    return c.json({ error: "default_score must be a number between 0 and 100" }, 400);
  }

  if (typeof body.devices !== "object" || body.devices === null) {
    return c.json({ error: "devices must be an object" }, 400);
  }

  for (const [id, device] of Object.entries(body.devices)) {
    if (typeof device.enabled !== "boolean") {
      return c.json({ error: `devices.${id}.enabled must be a boolean` }, 400);
    }
    if (typeof device.score !== "number" || device.score < 0 || device.score > 100) {
      return c.json({ error: `devices.${id}.score must be between 0 and 100` }, 400);
    }
    if (typeof device.label !== "string") {
      return c.json({ error: `devices.${id}.label must be a string` }, 400);
    }
  }

  await c.env.POSTURE_KV.put("config", JSON.stringify(body));
  return c.json({ ok: true });
});

export { config };
