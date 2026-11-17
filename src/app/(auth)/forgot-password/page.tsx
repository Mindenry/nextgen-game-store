import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-muted">
        Enter your email and we&apos;ll send a secure reset link. For privacy, we respond the same way whether or not
        an account exists.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
