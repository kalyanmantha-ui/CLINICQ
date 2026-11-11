import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner and blocks clicks while an action is in flight. */
  busy?: boolean;
}

/** The one button. Without a `type` it behaves like a native button (submits inside a form). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', busy, className, disabled, children, ...rest }, ref) {
  const cls = [variant === 'default' ? '' : variant, className].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={cls || undefined} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  );
});

/** Class names for a router <Link> that should look like a button. */
export const linkButtonClass = (variant: ButtonVariant = 'default') => `button ${variant === 'default' ? '' : variant}`.trim();
