import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui";

export function AccessDenied({ permission }: { permission: string }) {
  return (
    <Card className="p-10 text-center">
      <ShieldAlert className="mx-auto size-6 text-warning" />
      <h2 className="mt-3 text-lg font-semibold">Access denied</h2>
      <p className="mt-1 text-sm text-muted">
        Your role does not include the <span className="font-mono text-xs">{permission}</span> permission. Ask a Super
        Admin to grant it in Roles &amp; Permissions.
      </p>
    </Card>
  );
}
