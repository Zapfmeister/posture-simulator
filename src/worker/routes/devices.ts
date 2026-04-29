import { Hono } from "hono";
import type { HonoEnv, CloudflareDevice } from "../types";

const devices = new Hono<HonoEnv>();

interface CfApiResponse {
  success: boolean;
  result: CloudflareDevice[];
  result_info?: {
    cursor?: string;
  };
  errors?: Array<{ message: string }>;
}

/**
 * GET /api/devices
 *
 * Proxies the Cloudflare API to list enrolled WARP devices.
 * Handles cursor-based pagination, returns all devices in a single response.
 */
devices.get("/", async (c) => {
  const { CF_API_TOKEN, CF_ACCOUNT_ID } = c.env;

  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    return c.json({ error: "Missing CF_API_TOKEN or CF_ACCOUNT_ID" }, 500);
  }

  const allDevices: CloudflareDevice[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({ per_page: "50", status: "all" });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/devices/registrations?${params}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("CF API error:", resp.status, text);
        return c.json({ error: "Failed to fetch devices from Cloudflare API" }, 502);
      }

      const data: CfApiResponse = await resp.json();
      if (!data.success) {
        const msg = data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
        console.error("CF API error:", msg);
        return c.json({ error: msg }, 502);
      }

      allDevices.push(...data.result);
      cursor = data.result_info?.cursor;
    } while (cursor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Device fetch failed:", message);
    return c.json({ error: "Failed to fetch devices" }, 500);
  }

  return c.json({ devices: allDevices });
});

export { devices };
