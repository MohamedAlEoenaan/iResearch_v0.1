import { AuthLayout } from '@/components/public';
import { CommandForm } from '@/components/command-form';
export default async function Invitation({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthLayout>
      <p className="eyebrow">Organization invitation</p>
      <h1>Join your team</h1>
      {token ? (
        <CommandForm
          command="accept_invitation"
          data={{ token }}
          label="Accept invitation"
          fields={[
            {
              name: 'name',
              label: 'Your full name',
              required: true,
              minLength: 2,
            },
            {
              name: 'password',
              label: 'Create a password',
              type: 'password',
              required: true,
              minLength: 12,
            },
          ]}
        />
      ) : (
        <p className="notice">
          A valid invitation link is required. Invitation email delivery is
          currently disabled.
        </p>
      )}
    </AuthLayout>
  );
}
