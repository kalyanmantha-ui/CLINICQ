import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article';
  /** Flat, translucent card for secondary content. */
  muted?: boolean;
}

export function Card({ as: Tag = 'div', muted, className, ...rest }: CardProps) {
  return <Tag className={['card', muted ? 'muted' : '', className].filter(Boolean).join(' ')} {...rest} />;
}
