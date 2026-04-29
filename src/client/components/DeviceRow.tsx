import { useState } from "react";
import type { CloudflareDevice, DeviceConfig } from "../../worker/types";

interface Props {
  device: CloudflareDevice;
  config: DeviceConfig | undefined;
  onChange: (deviceId: string, config: DeviceConfig) => void;
}

export function DeviceRow({ device, config, onChange }: Props) {
  const enabled = config?.enabled ?? false;
  const score = config?.score ?? 50;
  const label = config?.label ?? device.name ?? device.id;

  const [localScore, setLocalScore] = useState(score);

  const handleToggle = () => {
    onChange(device.id, {
      enabled: !enabled,
      score: localScore,
      label,
    });
  };

  const handleScoreChange = (value: number) => {
    setLocalScore(value);
    onChange(device.id, {
      enabled,
      score: value,
      label,
    });
  };

  const email = device.user?.email ?? "—";
  const os = [device.os_distro_name, device.os_distro_revision]
    .filter(Boolean)
    .join(" ") || device.os_version || "—";

  return (
    <tr className={`border-b border-gray-800 ${enabled ? "bg-gray-900/50" : ""}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-100">{device.name || "Unnamed"}</div>
        <div className="text-xs text-gray-500">{device.id.slice(0, 8)}...</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{email}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{os}</td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            device.status === "active"
              ? "bg-green-900/50 text-green-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          {device.status}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-orange-500" : "bg-gray-700"
          }`}
          aria-label={enabled ? "Disable posture score" : "Enable posture score"}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={localScore}
            onChange={(e) => handleScoreChange(Number(e.target.value))}
            disabled={!enabled}
            className="h-2 w-28 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
          <span
            className={`w-8 text-right text-sm font-mono ${
              enabled ? "text-orange-400" : "text-gray-600"
            }`}
          >
            {localScore}
          </span>
        </div>
      </td>
    </tr>
  );
}
