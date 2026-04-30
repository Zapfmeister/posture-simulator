import { POSTURE_LEVELS } from "../../worker/types";

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function DefaultScore({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
      <span className="text-sm text-gray-400">Default score for unconfigured devices</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200"
      >
        {POSTURE_LEVELS.map((level) => (
          <option key={level.score} value={level.score}>
            {level.score} — {level.label}
          </option>
        ))}
      </select>
    </div>
  );
}
