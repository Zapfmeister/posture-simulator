import { useEffect, useState, useCallback } from "react";
import type { DeviceRegistration, DeviceConfig, PostureConfig } from "../worker/types";
import { fetchDevices, fetchConfig, saveConfig, fetchMe } from "./api";
import { DeviceRow } from "./components/DeviceRow";
import { DefaultScore } from "./components/DefaultScore";
import { SetupGuide } from "./components/SetupGuide";

type Status = "idle" | "loading" | "saving" | "saved" | "error";
type SetupState = "checking" | "needed" | "ready";

interface StatusResponse {
  configured: boolean;
  missing: string[];
}

async function checkSetupStatus(): Promise<StatusResponse> {
  const resp = await fetch("/api/status");
  if (!resp.ok) {
    return { configured: false, missing: ["UNKNOWN"] };
  }
  try {
    return (await resp.json()) as StatusResponse;
  } catch {
    return { configured: false, missing: ["UNKNOWN"] };
  }
}

export default function App() {
  const [setupState, setSetupState] = useState<SetupState>("checking");
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [cfDevices, setCfDevices] = useState<DeviceRegistration[]>([]);
  const [config, setConfig] = useState<PostureConfig>({ devices: {}, default_score: 0 });
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    checkSetupStatus().then((result) => {
      if (result.configured) {
        setSetupState("ready");
      } else {
        setMissingVars(result.missing);
        setSetupState("needed");
      }
    });
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const [devs, cfg, me] = await Promise.all([fetchDevices(), fetchConfig(), fetchMe()]);
      setCfDevices(devs);
      setConfig(cfg);
      setUserEmail(me.email);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (setupState === "ready") {
      load();
    }
  }, [setupState, load]);

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
    setConfig((prev) => {
      const updated = { ...prev.devices };
      for (const reg of cfDevices) {
        const devId = reg.device.id;
        updated[devId] = {
          enabled: true,
          score: updated[devId]?.score ?? prev.default_score,
          label: updated[devId]?.label ?? reg.device.name ?? devId,
        };
      }
      return { ...prev, devices: updated };
    });
    setDirty(true);
  };

  const handleDisableAll = () => {
    setConfig((prev) => {
      const updated = { ...prev.devices };
      for (const key of Object.keys(updated)) {
        const existing = updated[key];
        if (existing) {
          updated[key] = { ...existing, enabled: false };
        }
      }
      return { ...prev, devices: updated };
    });
    setDirty(true);
  };

  const enabledCount = Object.values(config.devices).filter((d) => d.enabled).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Posture Simulator</h1>
            {setupState === "ready" && (
              <p className="text-sm text-gray-500">
                {cfDevices.length} devices &middot; {enabledCount} with custom score
              </p>
            )}
          </div>
          {setupState === "ready" && (
            <div className="flex items-center gap-3">
              {userEmail && (
                <span className="text-sm text-gray-500">{userEmail}</span>
              )}
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
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 space-y-6">
        {setupState === "checking" && (
          <div className="py-20 text-center text-gray-500">Checking configuration...</div>
        )}

        {setupState === "needed" && <SetupGuide missing={missingVars} />}

        {setupState === "ready" && (
          <>
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
                No enrolled devices found. Check CF_API_TOKEN and CF_ACCOUNT_ID.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full text-left">
                  <thead className="border-b border-gray-800 bg-gray-900/80">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Device</th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">User</th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">WARP</th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Last Seen</th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Posture</th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfDevices.map((reg) => (
                      <DeviceRow
                        key={reg.device.id}
                        registration={reg}
                        config={config.devices[reg.device.id]}
                        onChange={handleDeviceChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
