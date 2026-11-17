import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOAuthAvailability } from "@/lib/auth/oauth";
import { getSettings } from "@/lib/settings";
import { Alert } from "@/components/ui";
import { RegisterForm } from "@/components/auth/register-form";
import { SocialButtons } from "@/components/social-buttons";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const [availability, settings] = await Promise.all([getOAuthAvailability(), getSettings()]);
  const open = Boolean(settings["store.registration_open"]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">Save your orders, wallet and digital products in one secure place.</p>
      </div>

      {!open ? (
        <Alert variant="warning" className="mb-4" title="Registration is closed">
          New accounts are temporarily disabled. Please check back later or contact support.
        </Alert>
      ) : (
        <>
          <RegisterForm />
          <div className="mt-6">
            <SocialButtons availability={availability} />
          </div>
        </>
      )}
    </div>
  );
}
