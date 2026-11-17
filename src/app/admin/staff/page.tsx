import { UserCog } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listStaff } from "@/lib/admin";
import { changeStaffRoleFormAction } from "@/actions/admin-content";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Input, Select, StatusPill, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { createStaffAction } from "@/actions/admin-content";

export const metadata = { title: "Staff" };

const STAFF_ROLES = ["support", "finance", "product_manager", "admin", "super_admin", "customer"];

export default async function AdminStaffPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.staffManage)) return <AccessDenied permission={PERMISSIONS.staffManage} />;
  const staff = await listStaff();

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Staff management"
        description="Staff permissions are checked on the server for every action — hiding buttons is never the only protection."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Team members</h2>
          <div className="mt-3">
            <Table className="min-w-[620px]">
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last login</Th><Th>Change role</Th></tr></thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <Td>
                      <p className="text-xs font-medium text-fg">{member.display_name}</p>
                      <p className="text-[10px] text-muted">{member.email}</p>
                    </Td>
                    <Td><Badge tone="primary" className="capitalize">{member.role_id.replaceAll("_", " ")}</Badge></Td>
                    <Td><StatusPill status={member.status} /></Td>
                    <Td className="text-[10px]">{member.last_login_at ? formatDate(member.last_login_at, true) : "never"}</Td>
                    <Td>
                      {member.id === user.id ? (
                        <span className="text-[10px] text-muted">You</span>
                      ) : (
                        <form action={changeStaffRoleFormAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="userId" value={member.id} />
                          <select name="roleId" defaultValue={member.role_id} className="focus-ring h-8 rounded-lg border border-border bg-surface px-1.5 text-[10px]">
                            {STAFF_ROLES.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                          </select>
                          <button type="submit" className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-fg-soft hover:text-fg">
                            Save
                          </button>
                        </form>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-3 text-[10px] text-muted">Changing a role signs the member out of all sessions. Demoting to customer removes admin access immediately.</p>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><UserCog className="size-4 text-primary" /> Add staff account</h2>
          <p className="mt-1 text-[11px] text-muted">
            {process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL
              ? "Creates a confirmed Supabase user and app profile."
              : "Local mode: creates an email/password account with a verified email. Share the password securely."}
          </p>
          <div className="mt-3">
            <AdminActionForm action={createStaffAction} submitLabel="Create staff account">
              <Input name="displayName" required placeholder="Full name" />
              <Input name="email" required type="email" placeholder="staff@example.com" className="mt-2" />
              <Select name="roleId" defaultValue="support" className="mt-2">
                {STAFF_ROLES.filter((role) => role !== "customer").map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </Select>
              <Input name="password" type="password" minLength={8} placeholder="Temporary password (min 8)" className="mt-2" autoComplete="new-password" />
            </AdminActionForm>
          </div>
          <p className="mt-3 text-[10px] text-muted">
            Passwords are hashed with scrypt. Staff should change them after first sign-in.
          </p>
        </Card>
      </div>
    </div>
  );
}
