import { Hono } from "hono";
import type {
  HonoEnv,
  PostureConfig,
  PostureRequest,
  PostureResponse,
} from "../types";

const posture = new Hono<HonoEnv>();

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

  // Read config from KV
  const raw = await c.env.POSTURE_KV.get("config", "text");
  const config: PostureConfig = raw
    ? JSON.parse(raw)
    : { devices: {}, default_score: 50 };

  const result: PostureResponse["result"] = {};

  for (const device of body.devices) {
    const entry = config.devices[device.device_id];
    const score =
      entry && entry.enabled ? entry.score : config.default_score;

    result[device.device_id] = {
      s2s_id: "",
      score,
    };
  }

  return c.json({ result });
});

export { posture };
