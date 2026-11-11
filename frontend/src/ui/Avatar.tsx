export const initials = (name: string) => name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden="true">{initials(name)}</span>;
}
