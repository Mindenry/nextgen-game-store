import { Gamepad2, Plus, RotateCcw } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { adminTopupData } from "@/lib/admin";
import { formatTHB } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { buttonClass, Card, Input, Select, StatusPill, Table, Td, Textarea, Th } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";
import { AdminActionForm } from "@/components/admin/admin-action-form";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import {
  processTopupAction,
  refundTopupAction,
  saveTopupGameAction,
  saveTopupPackageAction,
} from "@/actions/admin-orders";

export const metadata = { title: "Game top-up" };

const DEFAULT_FIELDS = JSON.stringify(
  [{ key: "player_id", label: "Player ID", required: true, placeholder: "123456789", pattern: "^[0-9]{5,20}$" }],
  null,
  2,
);

export default async function AdminTopupPage() {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.topupView)) return <AccessDenied permission={PERMISSIONS.topupView} />;
  const data = await adminTopupData();
  const canManage = can(user, PERMISSIONS.topupManage);
  const canProcess = can(user, PERMISSIONS.topupProcess);
  const canRefund = can(user, PERMISSIONS.ordersRefund);

  return (
    <div>
      <PageHeader
        eyebrow="Top-up"
        title="Game top-up"
        description="Add games and packages without code changes. Fulfilment is manual until a provider adapter is connected — no fake API calls."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Games</h2>
            <div className="mt-3 space-y-2">
              {data.games.map((game) => (
                <details key={game.id} className="rounded-xl border border-border p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Gamepad2 className="size-4" /></span>
                      <div>
                        <p className="text-xs font-semibold text-fg">{game.name}</p>
                        <p className="font-mono text-[9px] text-muted">{game.slug} · {game.product_count} packages · {game.fields.length} fields</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold ${game.is_active ? "text-success" : "text-muted"}`}>{game.is_active ? "Active" : "Hidden"}</span>
                  </summary>
                  <div className="mt-3 border-t border-border pt-3">
                    {canManage ? (
                      <AdminActionForm action={saveTopupGameAction} submitLabel="Save game" compact>
                        <input type="hidden" name="id" value={game.id} />
                        <GameFields game={game} />
                      </AdminActionForm>
                    ) : (
                      <pre className="overflow-x-auto text-[10px] text-muted">{JSON.stringify(game.fields, null, 2)}</pre>
                    )}
                  </div>
                </details>
              ))}
              {data.games.length === 0 ? <p className="text-xs text-muted">No games yet.</p> : null}
            </div>

            {canManage ? (
              <details className="mt-3">
                <summary className={`${buttonClass({ variant: "outline", size: "sm" })} inline-flex`}>
                  <Plus className="size-3.5" /> Add game
                </summary>
                <div className="mt-3 rounded-xl bg-surface-2/60 p-3">
                  <AdminActionForm action={saveTopupGameAction} submitLabel="Create game" compact>
                    <GameFields />
                  </AdminActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Top-up orders</h2>
            <div className="mt-3">
              <Table className="min-w-[880px]">
                <thead><tr><Th>Order</Th><Th>Game / package</Th><Th>Player</Th><Th>Status</Th><Th>Customer</Th><Th>Created</Th><Th>Actions</Th></tr></thead>
                <tbody>
                  {data.orders.map((order) => (
                    <tr key={order.id}>
                      <Td className="font-mono text-[10px]">{order.order_number}</Td>
                      <Td>
                        <p className="text-xs font-medium text-fg">{order.game_name}</p>
                        <p className="text-[10px] text-muted">{order.package_name}</p>
                      </Td>
                      <Td>
                        <pre className="max-w-[180px] truncate text-[9px] text-muted">{Object.entries(order.player_fields).map(([k, v]) => `${k}=${v}`).join(" · ")}</pre>
                      </Td>
                      <Td><StatusPill status={order.status} /></Td>
                      <Td className="text-[10px]">{order.email}</Td>
                      <Td className="text-[10px]">{formatDate(order.created_at, true)}</Td>
                      <Td>
                        <div className="flex flex-col gap-1.5">
                          {canProcess && !["COMPLETED", "REFUNDED"].includes(order.status) ? (
                            <details>
                              <summary className="cursor-pointer text-[10px] font-semibold text-primary">Update</summary>
                              <div className="mt-1 w-52 rounded-lg bg-surface-2 p-2">
                                <AdminActionForm action={processTopupAction} submitLabel="Save" compact>
                                  <input type="hidden" name="topupId" value={order.id} />
                                  <Select name="status" defaultValue="COMPLETED" className="mb-1.5 !h-8 !text-[11px]">
                                    <option value="PROCESSING">Processing</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="MANUAL_REVIEW">Manual review</option>
                                    <option value="FAILED">Failed</option>
                                  </Select>
                                  <Input name="note" placeholder="Note / reason" className="!h-8 !text-[11px]" />
                                </AdminActionForm>
                              </div>
                            </details>
                          ) : null}
                          {canRefund && order.status === "FAILED" ? (
                            <AdminActionButton
                              action={refundTopupAction.bind(null, order.id)}
                              label="Refund"
                              variant="danger"
                              icon={<RotateCcw className="size-3" />}
                              confirmText="Refund this top-up amount to the customer wallet?"
                            />
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {data.orders.length === 0 ? <tr><Td colSpan={7} className="py-10 text-center text-xs text-muted">No top-up orders yet.</Td></tr> : null}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Packages</h2>
            <div className="mt-3 space-y-1.5">
              {data.products.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-[11px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{product.name}</p>
                    <p className="text-[9px] text-muted">{product.game_name} · {formatTHB(product.price)}</p>
                  </div>
                  <StatusPill status={product.is_active ? "AVAILABLE" : "DISABLED"} />
                </div>
              ))}
              {data.products.length === 0 ? <p className="text-xs text-muted">No packages yet.</p> : null}
            </div>

            {canManage ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-semibold text-primary">Add package</summary>
                <div className="mt-2">
                  <AdminActionForm action={saveTopupPackageAction} submitLabel="Add package" compact>
                    <Select name="gameId" defaultValue={data.games[0]?.id ?? ""} className="mb-2 !h-9 !text-[11px]">
                      {data.games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
                    </Select>
                    <Input name="name" required placeholder="Package name" className="mb-2 !h-9 !text-[11px]" />
                    <Input name="price" required type="number" step="0.01" placeholder="Price THB" className="mb-2 !h-9 !text-[11px]" />
                    <Input name="compareAtPrice" type="number" step="0.01" placeholder="Compare-at (optional)" className="mb-2 !h-9 !text-[11px]" />
                    <Input name="sku" placeholder="SKU (optional)" className="mb-2 !h-9 !text-[11px]" />
                    <Input name="sortOrder" type="number" defaultValue="0" placeholder="Sort order" className="mb-2 !h-9 !text-[11px]" />
                    <label className="flex items-center gap-2 text-[11px] text-fg-soft">
                      <input type="checkbox" name="isActive" defaultChecked className="accent-[var(--primary)]" /> Active
                    </label>
                  </AdminActionForm>
                </div>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Player field schema</h2>
            <p className="mt-1 text-[11px] text-muted">
              Each game can request different fields. Use JSON:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[9px] leading-relaxed text-muted">{`[{ "key": "server_id",
   "label": "Server ID",
   "required": true,
   "pattern": "^[0-9]{1,6}$",
   "placeholder": "1234" }]`}</pre>
            <p className="mt-2 text-[10px] text-muted">Validation runs server-side before the order is created.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GameFields({ game }: { game?: { name: string; slug: string; logo_url: string | null; banner_url?: string | null; fields: unknown; sort_order?: number; is_active: boolean } }) {
  return (
    <div className="space-y-2">
      <Input name="name" required defaultValue={game?.name ?? ""} placeholder="Game name" className="!h-9 !text-[11px]" />
      <Input name="slug" defaultValue={game?.slug ?? ""} placeholder="slug (auto)" className="!h-9 !text-[11px]" />
      <Input name="logoUrl" defaultValue={game?.logo_url ?? ""} placeholder="Logo URL (optional)" className="!h-9 !text-[11px]" />
      <Input name="bannerUrl" defaultValue={game?.banner_url ?? ""} placeholder="Banner URL (optional)" className="!h-9 !text-[11px]" />
      <Textarea name="fields" rows={6} defaultValue={game ? JSON.stringify(game.fields, null, 2) : DEFAULT_FIELDS} className="font-mono !text-[10px]" />
      <div className="flex items-center gap-3">
        <Input name="sortOrder" type="number" defaultValue={game?.sort_order ?? 0} className="!h-9 w-24 !text-[11px]" />
        <label className="flex items-center gap-2 text-[11px] text-fg-soft">
          <input type="checkbox" name="isActive" defaultChecked={game?.is_active ?? true} className="accent-[var(--primary)]" /> Active
        </label>
      </div>
    </div>
  );
}
