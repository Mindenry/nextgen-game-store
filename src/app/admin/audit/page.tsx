import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listAuditLogs } from "@/lib/admin";
import { formatDate } from "@/lib/utils";
import { Card, Pagination, Table, Td, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";

export const metadata = { title: "Audit logs" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.auditView)) return <AccessDenied permission={PERMISSIONS.auditView} />;
  const params = await searchParams;
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const result = await listAuditLogs(page);

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Audit logs"
        description="Every sensitive admin action is recorded with actor, IP, timestamp and a before/after payload snapshot."
        actions={<p className="text-[11px] text-muted">{result.total} entries</p>}
      />

      <Card className="p-4">
        <Table className="min-w-[900px]">
          <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>IP</Th><Th>Details</Th></tr></thead>
          <tbody>
            {result.rows.map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-[10px]">{formatDate(log.created_at, true)}</Td>
                <Td className="text-[10px]">{log.actor_email ?? "system"}</Td>
                <Td className="font-mono text-[10px] text-fg">{log.action}</Td>
                <Td className="text-[10px]">
                  {log.entity_type}
                  {log.entity_id ? <span className="ml-1 font-mono text-[9px] text-muted">{log.entity_id.slice(0, 8)}…</span> : null}
                </Td>
                <Td className="text-[9px]">{log.ip ?? "—"}</Td>
                <Td>
                  {log.after ? (
                    <details>
                      <summary className="cursor-pointer text-[9px] font-semibold text-primary">View</summary>
                      <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2 text-[9px] text-muted">
                        {JSON.stringify(log.after, null, 2)}
                      </pre>
                    </details>
                  ) : "—"}
                </Td>
              </tr>
            ))}
            {result.rows.length === 0 ? <tr><Td colSpan={6} className="py-10 text-center text-xs text-muted">No audit entries yet.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>

      <Pagination
        page={result.page}
        pages={Math.max(1, Math.ceil(result.total / result.pageSize))}
        makeHref={(nextPage) => `/admin/audit?page=${nextPage}`}
      />
    </div>
  );
}
