import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Minus, Plus, UploadCloud, XMark } from './icons';

export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <label className="text-[15px] font-semibold text-ink">
        {children}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      {hint && <span className="text-[12px] font-medium text-faint">{hint}</span>}
    </div>
  );
}

export function SectionHeader({ label, tone }: { label: string; tone: 'required' | 'optional' }) {
  return (
    <div className="mb-5 mt-1 flex items-center gap-3">
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
          tone === 'required' ? 'text-brand' : 'text-faint'
        }`}
      >
        {label}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: string; group?: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  // Preserve first-seen order of groups; ungrouped options render at the top.
  const groups: string[] = [];
  for (const o of options) {
    const g = o.group ?? '';
    if (!groups.includes(g)) groups.push(g);
  }
  const grouped = groups.length > 1 || (groups.length === 1 && groups[0] !== '');

  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-[52px] w-full appearance-none rounded-xl border border-line bg-surface px-4 pr-11 text-[15px] font-medium text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {grouped
          ? groups.map((g) =>
              g === '' ? (
                options
                  .filter((o) => (o.group ?? '') === '')
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
              ) : (
                <optgroup key={g} label={g}>
                  {options
                    .filter((o) => o.group === g)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              ),
            )
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex-1">
      <div className="mb-1.5 text-[12px] font-medium text-muted">{label}</div>
      <div className="flex h-[52px] items-center justify-between rounded-xl border border-line bg-surface px-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink disabled:opacity-30"
        >
          <Minus />
        </button>
        <span className="min-w-6 text-center text-[15px] font-semibold tabular-nums text-ink">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-line-soft hover:text-ink disabled:opacity-30"
        >
          <Plus />
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-line-soft p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition ${
              active
                ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function UploadField({
  label,
  hint,
  accept,
  file,
  icon,
  onSelect,
  onClear,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  icon: ReactNode;
  onSelect: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">{file.name}</div>
            <div className="text-[12px] text-faint">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          <button
            type="button"
            aria-label="Remove file"
            onClick={onClear}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-line-soft hover:text-ink"
          >
            <XMark />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onSelect(f);
          }}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
            drag ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-faint'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-line-soft text-muted">
            <UploadCloud />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-ink">{`Upload a ${label.toLowerCase()}`}</div>
            <div className="text-[12px] text-faint">Drop a file or browse</div>
          </div>
        </button>
      )}
    </div>
  );
}
