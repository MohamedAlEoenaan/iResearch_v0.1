import { AuthLayout } from '@/components/public';
import { CommandForm } from '@/components/command-form';
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthLayout>
      <h1>Verify your email</h1>
      {token ? (
        <CommandForm
          command="verify_email"
          data={{ token }}
          label="Verify email address"
        />
      ) : (
        <p className="notice">
          A verification link is required. Email delivery is disabled.
        </p>
      )}
    </AuthLayout>
  );
}
