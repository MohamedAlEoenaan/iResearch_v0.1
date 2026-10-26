'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, UserRound, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { sendCommand } from './command-form';
const schema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(12).max(128),
  organizationName: z.string().optional(),
});
type Values = z.infer<typeof schema>;
export function RegistrationForm() {
  const [type, setType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL'),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  if (done)
    return (
      <div className="notice">
        <CheckCircle2 />
        <h2>Registration recorded</h2>
        <p>{done}</p>
        <Link href="/login">Back to sign in →</Link>
      </div>
    );
  return (
    <>
      <div className="account-options">
        <button
          type="button"
          aria-pressed={type === 'INDIVIDUAL'}
          onClick={() => setType('INDIVIDUAL')}
        >
          <UserRound size={20} />
          <strong>Individual</strong>
          <small>Research for yourself</small>
        </button>
        <button
          type="button"
          aria-pressed={type === 'ORGANIZATION'}
          onClick={() => setType('ORGANIZATION')}
        >
          <Building2 size={20} />
          <strong>Organization</strong>
          <small>A workspace for your team</small>
        </button>
      </div>
      <form
        className="command-form"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          try {
            const result = await sendCommand('register', undefined, undefined, {
              ...values,
              accountType: type,
            });
            setDone(result.message);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Registration failed.');
          }
        })}
      >
        <label className="field">
          <span>
            Full name<span aria-hidden="true"> *</span>
          </span>
          <input {...register('name')} autoComplete="name" required />
          {errors.name && (
            <small role="alert">Enter at least 2 characters.</small>
          )}
        </label>
        {type === 'ORGANIZATION' && (
          <label className="field">
            <span>
              Organization legal name<span aria-hidden="true"> *</span>
            </span>
            <input {...register('organizationName')} required minLength={2} />
          </label>
        )}
        <label className="field">
          <span>
            Email address<span aria-hidden="true"> *</span>
          </span>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            required
          />
          {errors.email && (
            <small role="alert">Enter a valid email address.</small>
          )}
        </label>
        <label className="field">
          <span>
            Password<span aria-hidden="true"> *</span>
          </span>
          <input
            {...register('password')}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
          <small>At least 12 characters. Use a unique password.</small>
          {errors.password && (
            <small role="alert">Use between 12 and 128 characters.</small>
          )}
        </label>
        {type === 'ORGANIZATION' && (
          <p className="muted small">
            Registration review and service activation are separate. Additional
            members join by invitation only.
          </p>
        )}
        <p className="notice small">
          Email delivery is disabled. Your account will remain pending
          verification.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </>
  );
}
