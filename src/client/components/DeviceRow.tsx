import type { DeviceRegistration, DeviceConfig } from "../../worker/types";
import { POSTURE_LEVELS } from "../../worker/types";

interface Props {
  registration: DeviceRegistration;
  config: DeviceConfig | undefined;
  onChange: (deviceId: string, config: DeviceConfig) => void;
}

function formatLastSeen(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "—";
  }
}

const LEVEL_COLORS: Record<number, string> = {
  0: "text-red-500",
  1: "text-red-400",
  2: "text-orange-400",
  3: "text-yellow-400",
  4: "text-blue-400",
  5: "text-green-400",
  6: "text-emerald-300",
};

export function DeviceRow({ registration: reg, config, onChange }: Props) {
  const deviceId = reg.device.id;
  const enabled = config?.enabled ?? false;
  const score = config?.score ?? 0;
  const label = config?.label ?? reg.device.name ?? deviceId;

  const email = reg.user?.email ?? "—";
  const warpVersion = reg.device.client_version ?? "—";
  const lastSeen = formatLastSeen(reg.last_seen_at);

  const handleToggle = () => {
    onChange(deviceId, { enabled: !enabled, score, label });
  };

  const handleScoreChange = (value: number) => {
    onChange(deviceId, { enabled, score: value, label });
  };

  const levelInfo = POSTURE_LEVELS[score];
  const colorClass = enabled ? (LEVEL_COLORS[score] ?? "text-gray-400") : "text-gray-600";

  return (
    <tr className={`border-b border-gray-800 ${enabled ? "bg-gray-900/50" : ""}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-100">{reg.device.name || "Unnamed"}</div>
        <div className="text-xs text-gray-500">{deviceId.slice(0, 8)}...</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">{email}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{warpVersion}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{lastSeen}</td>
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
        <select
          value={score}
          onChange={(e) => handleScoreChange(Number(e.target.value))}
          disabled={!enabled}
          className={`rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm ${colorClass} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {POSTURE_LEVELS.map((level) => (
            <option key={level.score} value={level.score}>
              {level.score} — {level.label}
            </option>
          ))}
        </select>
        {enabled && levelInfo && (
          <div className="mt-1 text-xs text-gray-500">{levelInfo.description}</div>
        )}
      </td>
    </tr>
  );
}
