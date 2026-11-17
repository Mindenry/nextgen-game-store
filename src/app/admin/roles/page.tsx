import { ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { rolePermissionMatrix } from "@/lib/admin";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { saveRolePermissionsAction } from "@/actions/admin-content";

export const metadata = { title: "Roles & permissions" };

export default async function AdminRolesPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.rolesManage)) return <AccessDenied permission={PERMISSIONS.rolesManage} />;
  const { roles, permissions, byRole } = await rolePermissionMatrix();

  return (
    <div>
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Permissions are stored in the database and enforced server-side. Super Admin always has every permission; Customer permissions are fixed."
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold capitalize text-fg">{role.name}</p>
              <Badge tone="outline">{byRole.get(role.id)?.size ?? 0}</Badge>
            </div>
            <p className="mt-1 text-[10px] text-muted">{role.description}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {roles
          .filter((role) => role.id !== "super_admin")
          .map((role) => {
            const active = byRole.get(role.id) ?? new Set<string>();
            const readOnly = role.id === "customer";
            return (
              <Card key={role.id} className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold capitalize">
                    <ShieldCheck className="size-4 text-primary" /> {role.name}
                  </h2>
                  <Badge tone={readOnly ? "neutral" : "primary"}>{readOnly ? "Fixed" : "Editable"}</Badge>
                </div>
                {readOnly ? (
                  <p className="mt-2 text-[11px] text-muted">Customers only access their own orders, wallet and delivered products through RLS and server checks.</p>
                ) : (
                  <div className="mt-3">
                    <AdminActionForm action={saveRolePermissionsAction} submitLabel={`Save ${role.name} permissions`} compact>
                      <input type="hidden" name="roleId" value={role.id} />
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {permissions.map((permission) => (
                          <label key={permission.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-[10px]">
                            <input
                              type="checkbox"
                              name="permissions"
                              value={permission.id}
                              defaultChecked={active.has(permission.id)}
                              className="mt-0.5 accent-[var(--primary)]"
                            />
                            <span>
                              <span className="block font-mono font-medium text-fg">{permission.id}</span>
                              <span className="text-muted">{permission.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </AdminActionForm>
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
