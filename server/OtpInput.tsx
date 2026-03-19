interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  id?: string;
}

export default function OtpInput({ value, onChange, onPaste, id }: OtpInputProps) {
  return (
    <div className="relative flex justify-center gap-2 mt-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-12 h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-bold font-mono transition-all ${
            value.length === i
              ? "border-[var(--brand)] ring-4 ring-[var(--brand)]/20"
              : value.length > i
              ? "border-foreground"
              : "border-border bg-muted/30"
          }`}
        >
          {value[i] || ""}
        </div>
      ))}
      <input
        id={id}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        autoFocus
        autoComplete="one-time-code"
      />
    </div>
  );
}