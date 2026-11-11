import type { ReactNode } from 'react';

export type NoticeKind = 'error' | 'ok' | 'info';

/** Inline message. Errors are announced immediately (role=alert); the rest politely. */
export function Notice({ kind, children }: { kind: NoticeKind; children: ReactNode }) {
  const role = kind === 'error' ? 'alert' : kind === 'ok' ? 'status' : undefined;
  return <p role={role} className={kind}>{children}</p>;
}
