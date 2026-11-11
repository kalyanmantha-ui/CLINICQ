import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'booked' | 'waiting' | 'offered' | 'completed' | 'cancelled' | 'role' | 'open';

/** Small status label. Colour is never the only signal: the text always says the status. */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={tone === 'neutral' ? 'pill' : `pill ${tone}`}>{children}</span>;
}

const KNOWN = new Set<PillTone>(['booked', 'waiting', 'offered', 'completed', 'cancelled']);
/** Maps an API status such as "BOOKED" to a pill tone. */
export const statusTone = (status: string): PillTone => (KNOWN.has(status.toLowerCase() as PillTone) ? (status.toLowerCase() as PillTone) : 'neutral');
