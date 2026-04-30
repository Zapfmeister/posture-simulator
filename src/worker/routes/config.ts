import { Hono } from "hono";
import type { HonoEnv, PostureConfig } from "../types";
import { MAX_POSTURE_SCORE } from "../types";

const DEFAULT_CONFIG: PostureConfig = {
  devices: {},
  default_score: 0,
};

const config = new Hono<HonoEnv>();

config.get("/", async (c) => {
  try {
    const raw = await c.env.POSTURE_KV.get("config", "text");
    if (!raw) {
      return c.json(DEFAULT_CONFIG);
    }
    const parsed: PostureConfig = JSON.parse(raw);
    return c.json(parsed);
  } catch (err) {
    console.error("Failed to read config from KV:", err);
    return c.json(DEFAULT_CONFIG);
  }
});

config.put("/", async (c) => {
  let body: PostureConfig;
  try {
    body = await c.req.json<PostureConfig>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body.default_score !== "number" ||
    !Number.isInteger(body.default_score) ||
    body.default_score < 0 ||
    body.default_score > MAX_POSTURE_SCORE
  ) {
    return c.json({ error: `default_score must be an integer between 0 and ${MAX_POSTURE_SCORE}` }, 400);
  }

  if (typeof body.devices !== "object" || body.devices === null) {
    return c.json({ error: "devices must be an object" }, 400);
  }

  // Validate and sanitize each device entry (strip unknown fields)
  const sanitized: PostureConfig = {
    default_score: body.default_score,
    devices: {},
  };

  for (const [id, device] of Object.entries(body.devices)) {
    if (typeof device.enabled !== "boolean") {
      return c.json({ error: `devices.${id}.enabled must be a boolean` }, 400);
    }
    if (typeof device.score !== "number" || !Number.isInteger(device.score) || device.score < 0 || device.score > MAX_POSTURE_SCORE) {
      return c.json({ error: `devices.${id}.score must be an integer between 0 and ${MAX_POSTURE_SCORE}` }, 400);
    }
    if (typeof device.label !== "string") {
      return c.json({ error: `devices.${id}.label must be a string` }, 400);
    }
    if (device.label.length > 256) {
      return c.json({ error: `devices.${id}.label exceeds 256 characters` }, 400);
    }

    sanitized.devices[id] = {
      enabled: device.enabled,
      score: device.score,
      label: device.label,
    };
  }

  await c.env.POSTURE_KV.put("config", JSON.stringify(sanitized));
  return c.json({ ok: true });
});

export { config };
