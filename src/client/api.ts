import type { PostureConfig, CloudflareDevice } from "../worker/types";

export async function fetchDevices(): Promise<CloudflareDevice[]> {
  const resp = await fetch("/api/devices");
  if (!resp.ok) {
    throw new Error(`Failed to fetch devices: ${resp.status}`);
  }
  const data = await resp.json() as { devices: CloudflareDevice[] };
  return data.devices;
}

export async function fetchConfig(): Promise<PostureConfig> {
  const resp = await fetch("/api/config");
  if (!resp.ok) {
    throw new Error(`Failed to fetch config: ${resp.status}`);
  }
  return resp.json() as Promise<PostureConfig>;
}

export async function saveConfig(config: PostureConfig): Promise<void> {
  const resp = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!resp.ok) {
    const data = await resp.json() as { error?: string };
    throw new Error(data.error ?? `Save failed: ${resp.status}`);
  }
}
