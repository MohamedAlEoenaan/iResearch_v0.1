import { AuthLayout } from '@/components/public';
import { CommandForm } from '@/components/command-form';
export default function Forgot() {
  return (
    <AuthLayout>
      <p className="eyebrow">Account recovery</p>
      <h1>Reset your password</h1>
      <p className="notice small">
        Email delivery is disabled. We can record your request, but a reset link
        cannot be sent yet.
      </p>
      <CommandForm
        command="forgot_password"
        label="Record reset request"
        fields={[
          {
            name: 'email',
            label: 'Account email',
            type: 'email',
            required: true,
          },
        ]}
      />
    </AuthLayout>
  );
}
