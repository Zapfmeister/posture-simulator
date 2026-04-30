import type { PostureConfig, DeviceRegistration } from "../worker/types";

async function parseJsonSafe(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function isDevicesResponse(data: unknown): data is { devices: DeviceRegistration[] } {
  if (typeof data !== "object" || data === null || !("devices" in data)) return false;
  const arr = (data as { devices: unknown }).devices;
  if (!Array.isArray(arr)) return false;
  // Validate first element has nested device.id structure
  if (arr.length > 0) {
    const first = arr[0] as Record<string, unknown>;
    if (typeof first["device"] !== "object" || first["device"] === null) return false;
  }
  return true;
}

function isPostureConfig(data: unknown): data is PostureConfig {
  return (
    typeof data === "object" &&
    data !== null &&
    "default_score" in data &&
    "devices" in data
  );
}

export interface UserInfo {
  email: string | null;
}

export async function fetchMe(): Promise<UserInfo> {
  const resp = await fetch("/api/me");
  if (!resp.ok) {
    return { email: null };
  }
  const data = await parseJsonSafe(resp);
  if (typeof data === "object" && data !== null && "email" in data) {
    return { email: typeof (data as { email: unknown }).email === "string" ? (data as { email: string }).email : null };
  }
  return { email: null };
}

export async function fetchDevices(): Promise<DeviceRegistration[]> {
  const resp = await fetch("/api/devices");
  if (!resp.ok) {
    throw new Error(`Failed to fetch devices: ${resp.status}`);
  }
  const data = await parseJsonSafe(resp);
  if (!isDevicesResponse(data)) {
    throw new Error("Unexpected response format from /api/devices");
  }
  return data.devices;
}

export async function fetchConfig(): Promise<PostureConfig> {
  const resp = await fetch("/api/config");
  if (!resp.ok) {
    throw new Error(`Failed to fetch config: ${resp.status}`);
  }
  const data = await parseJsonSafe(resp);
  if (!isPostureConfig(data)) {
    throw new Error("Unexpected response format from /api/config");
  }
  return data;
}

export async function saveConfig(config: PostureConfig): Promise<void> {
  const resp = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!resp.ok) {
    let message = `Save failed: ${resp.status}`;
    const data = await parseJsonSafe(resp);
    if (typeof data === "object" && data !== null && "error" in data) {
      message = String((data as { error: unknown }).error);
    }
    throw new Error(message);
  }
}
