import Link from 'next/link';
import { AuthLayout } from '@/components/public';
import { RegistrationForm } from '@/components/registration-form';
export default function Register() {
  return (
    <AuthLayout>
      <p className="eyebrow">Get started</p>
      <h1>Create your account</h1>
      <p className="muted small">
        Choose how you’ll use iResearch. Personal and organization accounts
        remain separate.
      </p>
      <RegistrationForm />
      <div className="auth-links">
        <p>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
