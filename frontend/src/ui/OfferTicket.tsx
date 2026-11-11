import { Button } from './Button';

export const OFFER_SECONDS = 15 * 60;
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * A held slot, shaped like a ticket with a ring that drains as the 15 minutes run out.
 * `now` is passed in so the clock is easy to drive from a test or a story.
 */
export function OfferTicket({ doctorName, when, expiresAt, now, busy, onAccept, onDecline }: {
  doctorName: string; when: string; expiresAt: string; now: number; busy?: boolean;
  onAccept: () => void; onDecline: () => void;
}) {
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const fraction = Math.min(1, left / OFFER_SECONDS);
  const urgent = left > 0 && left <= 120;
  const R = 22, C = 2 * Math.PI * R;
  return (
    <div className={`card offer${urgent ? ' urgent' : ''}`} data-testid="offer">
      <svg className="ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} className="ring-track" />
        <circle cx="28" cy="28" r={R} className="ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} transform="rotate(-90 28 28)" />
      </svg>
      <h3>A slot opened up for you</h3>
      <p><strong>{doctorName}</strong> · {when}</p>
      <p className="timer" aria-live="off">{left > 0 ? `Offer held for ${formatClock(left)}` : 'This offer has expired'}</p>
      <div className="row">
        <Button variant="primary" busy={busy} disabled={left === 0} onClick={onAccept}>Book it</Button>
        <Button busy={busy} disabled={left === 0} onClick={onDecline}>No thanks</Button>
      </div>
    </div>
  );
}
