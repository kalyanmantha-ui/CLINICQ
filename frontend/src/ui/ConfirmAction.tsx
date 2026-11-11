import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

/** A destructive action that needs a second, explicit click. Focus moves to the confirm button so keyboard users are not lost. */
export function ConfirmAction({ label, confirmLabel, keepLabel = 'Keep', onConfirm }: {
  label: string; confirmLabel: string; keepLabel?: string; onConfirm: () => void | Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (asking) confirmRef.current?.focus(); }, [asking]);
  if (!asking) return <Button onClick={() => setAsking(true)}>{label}</Button>;
  return (
    <span className="row">
      <Button ref={confirmRef} variant="danger" busy={busy}
        onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setAsking(false); } }}>{confirmLabel}</Button>
      <Button onClick={() => setAsking(false)}>{keepLabel}</Button>
    </span>
  );
}
