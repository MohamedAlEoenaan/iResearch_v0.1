'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'textarea' | 'select';
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
};
export async function sendCommand(
  command: string,
  id?: string,
  version?: number,
  data: Record<string, unknown> = {},
) {
  const response = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, id, version, data }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? 'Unable to complete the request.');
  return result;
}
export function CommandForm({
  command,
  id,
  version,
  fields = [],
  data = {},
  label,
  variant = 'default',
  confirm,
  stay = false,
  children,
}: {
  command: string;
  id?: string;
  version?: number;
  fields?: Field[];
  data?: Record<string, unknown>;
  label: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  confirm?: string;
  stay?: boolean;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const busy = pending || refreshing;
  return (
    <form
      className="command-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        setPending(true);
        setError('');
        setMessage('');
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        try {
          const result = await sendCommand(command, id, version, {
            ...data,
            ...values,
          });
          if (result.redirect && !stay) {
            if (command === 'logout') window.location.assign(result.redirect);
            else router.push(result.redirect);
          } else {
            startTransition(() => {
              setMessage(result.message ?? 'Changes saved.');
              router.refresh();
            });
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Something went wrong.',
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {fields.map((f) => (
        <label className="field" key={f.name}>
          <span>
            {f.label}
            {f.required && <span aria-hidden="true"> *</span>}
          </span>
          {f.type === 'textarea' ? (
            <textarea
              name={f.name}
              defaultValue={f.value}
              required={f.required}
              minLength={f.minLength}
              maxLength={f.maxLength ?? 10000}
              placeholder={f.placeholder}
              rows={5}
            />
          ) : f.type === 'select' ? (
            <select
              name={f.name}
              defaultValue={f.value ?? ''}
              required={f.required}
            >
              <option value="" disabled>
                Select an option
              </option>
              {f.options?.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type ?? 'text'}
              defaultValue={f.value}
              required={f.required}
              minLength={f.minLength}
              maxLength={f.maxLength ?? 254}
              placeholder={f.placeholder}
              autoComplete={
                f.type === 'password'
                  ? command === 'login'
                    ? 'current-password'
                    : 'new-password'
                  : f.name === 'email'
                    ? 'email'
                    : undefined
              }
            />
          )}
        </label>
      ))}
      {children}
      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}
      <Button type="submit" variant={variant} disabled={busy}>
        {busy && <Loader2 size={15} className="spin" />}
        {busy ? 'Working…' : label}
      </Button>
    </form>
  );
}
