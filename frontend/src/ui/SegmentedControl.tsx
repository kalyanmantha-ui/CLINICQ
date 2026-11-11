import { useRef, type KeyboardEvent } from 'react';

export interface Segment<T extends string> { value: T; label: string }

/** A radio group styled as a pill toggle. Arrow keys move between options, as a native radio group does. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Segment<T>[]; onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => move(e, i)}>{o.label}</button>
      ))}
    </div>
  );
}
