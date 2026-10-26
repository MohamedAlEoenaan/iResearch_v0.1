import Link from 'next/link';
import { AuthLayout } from '@/components/public';
import { CommandForm } from '@/components/command-form';
export default function Login() {
  return (
    <AuthLayout>
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in to your workspace</h1>
      <p className="muted small">Continue where you left off.</p>
      <CommandForm
        command="login"
        label="Sign in"
        fields={[
          {
            name: 'email',
            label: 'Email address',
            type: 'email',
            required: true,
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            required: true,
          },
        ]}
      />
      <div className="auth-links">
        <Link href="/forgot-password">Forgot your password?</Link>
        <p>
          New to iResearch? <Link href="/register">Create an account</Link>
        </p>
        <p className="small">
          New registrations require verification. Email delivery is currently
          disabled.
        </p>
      </div>
    </AuthLayout>
  );
}
