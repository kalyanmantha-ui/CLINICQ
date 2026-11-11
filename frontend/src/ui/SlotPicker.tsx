import { useMemo, useState } from 'react';
import { clinicMinutes, dayKey, fmtDayNumber, fmtMonthDay, fmtTime, fmtWeekday, type Slot } from '../api';

const PARTS = [['Morning', 0, 12 * 60], ['Afternoon', 12 * 60, 17 * 60], ['Evening', 17 * 60, 24 * 60]] as const;

/**
 * Pick a day from a strip, then a time. The strip shows how many open times each day has, so it reads like a calendar
 * rather than a long list. Every control is a button; the selected ones announce aria-pressed.
 */
export function SlotPicker({ slots, selectedId, onSelect }: { slots: Slot[]; selectedId?: string | null; onSelect: (slot: Slot) => void }) {
  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) { const k = dayKey(s.startAt); m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()];
  }, [slots]);
  const [chosen, setChosen] = useState<string | null>(null);
  const activeKey = days.find(([k]) => k === chosen)?.[0] ?? days[0]?.[0];
  const active = days.find(([k]) => k === activeKey)?.[1] ?? [];

  return (
    <div className="slotpicker">
      <div className="daystrip" role="group" aria-label="Choose a day">
        {days.map(([k, list]) => (
          <button key={k} type="button" className={k === activeKey ? 'daychip on' : 'daychip'} aria-pressed={k === activeKey}
            onClick={() => setChosen(k)}>
            <span>{fmtWeekday(list[0].startAt)}</span> <b>{fmtDayNumber(list[0].startAt)}</b> <small>{list.length} open</small>
            <span className="sr-only">, {fmtMonthDay(list[0].startAt)}</span>
          </button>
        ))}
      </div>
      {PARTS.map(([name, from, to]) => {
        const list = active.filter((s) => { const m = clinicMinutes(s.startAt); return m >= from && m < to; });
        if (list.length === 0) return null;
        return (
          <section key={name} className="part" aria-label={name}>
            <h3>{name}</h3>
            <div className="slots">
              {list.map((s) => (
                <button key={s.id} type="button" className={selectedId === s.id ? 'primary' : ''} aria-pressed={selectedId === s.id} onClick={() => onSelect(s)}>
                  {fmtTime(s.startAt)}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
