import { AuthLayout } from '@/components/public';
import { CommandForm } from '@/components/command-form';
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthLayout>
      <h1>Choose a new password</h1>
      {token ? (
        <CommandForm
          command="reset_password"
          data={{ token }}
          label="Reset password"
          fields={[
            {
              name: 'password',
              label: 'New password',
              type: 'password',
              required: true,
              minLength: 12,
            },
          ]}
        />
      ) : (
        <p className="notice">
          A valid password reset link is required. Email delivery is disabled.
        </p>
      )}
    </AuthLayout>
  );
}
