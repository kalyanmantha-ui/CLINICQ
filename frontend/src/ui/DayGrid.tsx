import { clinicMinutes, fmtTime } from '../api';
import { useNow } from '../hooks';

export type GridTone = 'booked' | 'completed' | 'cancelled' | 'offered' | 'open';
export interface GridEvent { id: string; columnId: string; start: string; end: string; title: string; subtitle?: string; tone: GridTone }
export interface GridColumn { id: string; label: string }

const pad = (n: number) => String(n).padStart(2, '0');
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

/**
 * A day laid out by the clock: time runs down the page, one column per doctor, each appointment a block sized by its length.
 * Blocks are real buttons, so the grid works from the keyboard. `isToday` adds a "now" line.
 */
export function DayGrid({ label, columns, events, selectedId, onSelect, isToday, hourHeight = 72, fromHour, toHour }: {
  label: string; columns: GridColumn[]; events: GridEvent[]; selectedId?: string | null; onSelect?: (e: GridEvent) => void;
  isToday?: boolean; hourHeight?: number; fromHour?: number; toHour?: number;
}) {
  const now = useNow(30_000);
  const mins = events.flatMap((e) => [clinicMinutes(e.start), clinicMinutes(e.end) || 24 * 60]);
  const first = fromHour ?? Math.min(9, ...mins.map((m) => Math.floor(m / 60)));
  const last = toHour ?? Math.max(17, ...mins.map((m) => Math.ceil(m / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const gridCols = `56px repeat(${Math.max(1, columns.length)}, minmax(150px, 1fr))`;
  const nowMin = clinicMinutes(new Date(now).toISOString());
  const showNow = isToday && nowMin >= first * 60 && nowMin <= last * 60;

  return (
    <div className="daygrid" role="group" aria-label={label}>
      <div className="dg-head" style={{ gridTemplateColumns: gridCols }}>
        <span />
        {columns.map((c) => <strong key={c.id}>{c.label}</strong>)}
      </div>
      <div className="dg-body" style={{ gridTemplateColumns: gridCols, height: hours.length * hourHeight }}>
        <div className="dg-gutter" aria-hidden="true">
          {hours.map((h) => <span key={h} style={{ top: (h - first) * hourHeight }}>{hourLabel(h)}</span>)}
        </div>
        {columns.map((c) => (
          <div key={c.id} className="dg-col" style={{ backgroundSize: `100% ${hourHeight}px` }}>
            {events.filter((e) => e.columnId === c.id).map((e) => {
              const startMin = clinicMinutes(e.start);
              const endMin = clinicMinutes(e.end) || 24 * 60;
              const top = ((startMin - first * 60) / 60) * hourHeight;
              const height = Math.max(28, ((endMin - startMin) / 60) * hourHeight - 4);
              return (
                <button key={e.id} type="button" className={`dg-event ${e.tone}${selectedId === e.id ? ' selected' : ''}`}
                  style={{ top, height }} aria-pressed={selectedId === e.id} onClick={() => onSelect?.(e)}
                  aria-label={`${fmtTime(e.start)} ${e.title}${e.subtitle ? `, ${e.subtitle}` : ''}, ${e.tone}`}>
                  <b>{fmtTime(e.start)}</b> <span>{e.title}</span>
                  {e.subtitle && height >= 50 && <small>{e.subtitle}</small>}
                </button>
              );
            })}
          </div>
        ))}
        {showNow && <div className="dg-now" style={{ top: ((nowMin - first * 60) / 60) * hourHeight }} aria-hidden="true"><i>{pad(Math.floor(nowMin / 60))}:{pad(nowMin % 60)}</i></div>}
      </div>
    </div>
  );
}
