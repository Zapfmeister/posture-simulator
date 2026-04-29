import { useEffect, useState, useCallback } from "react";
import type { CloudflareDevice, DeviceConfig, PostureConfig } from "../worker/types";
import { fetchDevices, fetchConfig, saveConfig } from "./api";
import { DeviceRow } from "./components/DeviceRow";
import { DefaultScore } from "./components/DefaultScore";

type Status = "idle" | "loading" | "saving" | "saved" | "error";

export default function App() {
  const [cfDevices, setCfDevices] = useState<CloudflareDevice[]>([]);
  const [config, setConfig] = useState<PostureConfig>({ devices: {}, default_score: 50 });
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const [devs, cfg] = await Promise.all([fetchDevices(), fetchConfig()]);
      setCfDevices(devs);
      setConfig(cfg);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeviceChange = (deviceId: string, deviceConfig: DeviceConfig) => {
    setConfig((prev) => ({
      ...prev,
      devices: { ...prev.devices, [deviceId]: deviceConfig },
    }));
    setDirty(true);
  };

  const handleDefaultScoreChange = (value: number) => {
    setConfig((prev) => ({ ...prev, default_score: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setStatus("saving");
    setError(null);
    try {
      await saveConfig(config);
      setStatus("saved");
      setDirty(false);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }
  };

  const handleEnableAll = () => {
    const updated = { ...config.devices };
    for (const dev of cfDevices) {
      updated[dev.id] = {
        enabled: true,
        score: updated[dev.id]?.score ?? config.default_score,
        label: updated[dev.id]?.label ?? dev.name ?? dev.id,
      };
    }
    setConfig((prev) => ({ ...prev, devices: updated }));
    setDirty(true);
  };

  const handleDisableAll = () => {
    const updated = { ...config.devices };
    for (const key of Object.keys(updated)) {
      updated[key] = { ...updated[key], enabled: false };
    }
    setConfig((prev) => ({ ...prev, devices: updated }));
    setDirty(true);
  };

  const enabledCount = Object.values(config.devices).filter((d) => d.enabled).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Posture Simulator</h1>
            <p className="text-sm text-gray-500">
              {cfDevices.length} devices &middot; {enabledCount} with custom score
            </p>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm text-red-400">{error}</span>
            )}
            {status === "saved" && (
              <span className="text-sm text-green-400">Saved</span>
            )}
            <button
              onClick={load}
              disabled={status === "loading"}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || status === "saving"}
              className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "saving" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <DefaultScore value={config.default_score} onChange={handleDefaultScoreChange} />
          <div className="flex gap-2">
            <button
              onClick={handleEnableAll}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
            >
              Enable all
            </button>
            <button
              onClick={handleDisableAll}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
            >
              Disable all
            </button>
          </div>
        </div>

        {status === "loading" && cfDevices.length === 0 ? (
          <div className="py-20 text-center text-gray-500">Loading devices...</div>
        ) : cfDevices.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            No enrolled devices found. Make sure CF_API_TOKEN and CF_ACCOUNT_ID are configured.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left">
              <thead className="border-b border-gray-800 bg-gray-900/80">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Device</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">User</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">OS</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Posture</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {cfDevices.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    config={config.devices[device.id]}
                    onChange={handleDeviceChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
