import type { CSSProperties } from 'react';

/** Loading placeholder. Hidden from screen readers; the surrounding region carries aria-busy. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonRows({ count = 3, height = 64 }: { count?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius={14} />)}
    </div>
  );
}
