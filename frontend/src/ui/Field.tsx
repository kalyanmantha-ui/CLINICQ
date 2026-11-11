import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Shell {
  label: ReactNode;
  hint?: string;
  error?: string;
  inline?: boolean;
}

function Wrap({ label, hint, error, inline, hintId, errorId, children }: Shell & { hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className={inline ? 'inline' : undefined}>{label}{children}</label>
      {hint && !error && <small id={hintId} className="hint">{hint}</small>}
      {error && <small id={errorId} className="hint bad" role="alert">{error}</small>}
    </div>
  );
}

const describe = (hint: string | undefined, error: string | undefined, hintId: string, errorId: string) =>
  ({ 'aria-describedby': error ? errorId : hint ? hintId : undefined, 'aria-invalid': error ? true : undefined });

export function TextField({ label, hint, error, inline, ...rest }: Shell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} inline={inline} hintId={`${id}-h`} errorId={`${id}-e`}>
      <input {...describe(hint, error, `${id}-h`, `${id}-e`)} {...rest} />
    </Wrap>
  );
}

export function SelectField({ label, hint, error, inline, children, ...rest }: Shell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} inline={inline} hintId={`${id}-h`} errorId={`${id}-e`}>
      <select {...describe(hint, error, `${id}-h`, `${id}-e`)} {...rest}>{children}</select>
    </Wrap>
  );
}

export function TextAreaField({ label, hint, error, inline, ...rest }: Shell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} inline={inline} hintId={`${id}-h`} errorId={`${id}-e`}>
      <textarea {...describe(hint, error, `${id}-h`, `${id}-e`)} {...rest} />
    </Wrap>
  );
}
