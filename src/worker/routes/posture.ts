import { Hono } from "hono";
import type {
  HonoEnv,
  PostureConfig,
  PostureRequest,
  PostureResponse,
} from "../types";

const posture = new Hono<HonoEnv>();

const MAX_DEVICES = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CONFIG: PostureConfig = { devices: {}, default_score: 0 };

/**
 * POST /api/posture
 *
 * Called by Cloudflare One Client during polling. Receives up to 1000
 * devices and returns a score (0-100) for each one. Devices with an
 * explicit config entry and enabled=true get their configured score;
 * everything else gets the default_score.
 */
posture.post("/", async (c) => {
  let body: PostureRequest;
  try {
    body = await c.req.json<PostureRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.devices || !Array.isArray(body.devices)) {
    return c.json({ error: "Missing or invalid devices array" }, 400);
  }

  if (body.devices.length > MAX_DEVICES) {
    return c.json({ error: `Too many devices (max ${MAX_DEVICES})` }, 400);
  }

  for (const device of body.devices) {
    if (typeof device.device_id !== "string" || !UUID_RE.test(device.device_id)) {
      return c.json({ error: "Invalid device_id format (expected UUID)" }, 400);
    }
  }

  let config: PostureConfig;
  try {
    const raw = await c.env.POSTURE_KV.get("config", "text");
    config = raw ? JSON.parse(raw) : DEFAULT_CONFIG;
  } catch (err) {
    console.error("Failed to read posture config from KV:", err);
    config = DEFAULT_CONFIG;
  }

  const result: PostureResponse["result"] = {};

  for (const device of body.devices) {
    const entry = config.devices[device.device_id];
    const score =
      entry?.enabled ? entry.score : config.default_score;

    result[device.device_id] = {
      s2s_id: "",
      score,
    };
  }

  return c.json({ result });
});

export { posture };
