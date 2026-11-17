import { Star } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/auth/rbac";
import { listReviews } from "@/lib/admin";
import { moderateReviewFormAction } from "@/actions/admin-content";
import { formatDate } from "@/lib/utils";
import { Badge, Card, Input } from "@/components/ui";
import { PageHeader } from "@/components/admin/page-header";
import { AccessDenied } from "@/components/admin/denied";

export const metadata = { title: "Reviews" };

const TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin");
  if (!can(user, PERMISSIONS.reviewsManage)) return <AccessDenied permission={PERMISSIONS.reviewsManage} />;
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const reviews = await listReviews(status || undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title="Reviews"
        description="Only verified purchases can submit reviews. Approving one recalculates the product rating."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <a
            key={tab.value}
            href={tab.value ? `/admin/reviews?status=${tab.value}` : "/admin/reviews"}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
              status === tab.value ? "border-primary bg-primary/8 text-primary" : "border-border bg-surface text-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {reviews.map((review) => (
          <Card key={review.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: review.rating }).map((_, index) => <Star key={index} className="size-3 fill-current" />)}
                </div>
                <p className="mt-1 text-xs font-semibold text-fg">{review.title || "(no title)"}</p>
                <p className="text-[10px] text-muted">{review.display_name} · {review.email}</p>
              </div>
              <Badge tone={review.status === "approved" ? "success" : review.status === "rejected" ? "danger" : "warning"}>
                {review.status}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-fg-soft">{review.body || "—"}</p>
            <p className="mt-2 text-[10px] text-muted">
              {review.product_name} · {formatDate(review.created_at, true)}
            </p>
            {review.status === "pending" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={moderateReviewFormAction} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <input name="note" placeholder="Moderation note" className="focus-ring h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-[10px]" />
                  <button type="submit" className="rounded-lg bg-success/12 px-2.5 py-1.5 text-[10px] font-semibold text-success">
                    Approve
                  </button>
                </form>
                <form action={moderateReviewFormAction}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button type="submit" className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[10px] font-semibold text-danger">
                    Reject
                  </button>
                </form>
              </div>
            ) : (
              <form action={moderateReviewFormAction} className="mt-3">
                <input type="hidden" name="reviewId" value={review.id} />
                <input type="hidden" name="decision" value={review.status === "approved" ? "rejected" : "approved"} />
                <button type="submit" className="text-[10px] font-semibold text-primary hover:underline">
                  {review.status === "approved" ? "Unpublish" : "Approve instead"}
                </button>
              </form>
            )}
          </Card>
        ))}
        {reviews.length === 0 ? <Card className="p-8 text-center text-xs text-muted md:col-span-2">No reviews in this view.</Card> : null}
      </div>
    </div>
  );
}
