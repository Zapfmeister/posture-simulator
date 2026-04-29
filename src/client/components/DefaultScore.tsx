interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function DefaultScore({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
      <span className="text-sm text-gray-400">Default score for unconfigured devices</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-32 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-orange-500"
      />
      <span className="w-8 text-right text-sm font-mono text-orange-400">{value}</span>
    </div>
  );
}
