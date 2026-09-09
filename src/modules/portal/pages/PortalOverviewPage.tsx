import { Link } from "react-router-dom";
import { MessageCircle, Store, Eye, BadgeCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { StatCard } from "@/shared/components/StatCard";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageLoader } from "@/shared/components/PageLoader";
import { useMyBusinesses } from "../hooks/useMyBusiness";

/**
 * The portal dashboard.
 *
 * Built around the one question an owner has when they open it: **can customers
 * reach me?** Booking-request counts arrive in Phase 5; until then this says
 * whether the channel that carries them is working, which is the fact those
 * counts would depend on anyway.
 */
export function PortalOverviewPage() {
  const user = useAppSelector((s) => s.auth.user);
  const { data: businesses, isLoading } = useMyBusinesses();

  if (isLoading) return <PageLoader />;

  const isAdmin = user?.role === "admin";

  return (
    <div className="ra-page">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {businesses?.length
            ? "Here's how your listing is doing."
            : "Your listing appears here once a claim is approved."}
        </p>
      </div>

      {!businesses || businesses.length === 0 ? (
        isAdmin ? (
          <EmptyState
            icon={Store}
            title="You manage the platform, not a listing"
            description="Administrators reach every business through the console."
            action={
              <Link
                to="/admin/businesses"
                className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open the console
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Store}
            title="No business yet"
            description="Claim your listing and it'll show up here, with the numbers customers reach you on."
            action={
              <Link
                to="/for-business"
                className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Claim your business
              </Link>
            }
          />
        )
      ) : (
        businesses.map((business) => (
          <section key={business.id} aria-labelledby={`b-${business.id}`} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id={`b-${business.id}`}
                className="flex items-center gap-2 text-base font-semibold text-foreground"
              >
                {business.name}
                {business.isVerified && (
                  <Badge tone="success" icon={BadgeCheck}>
                    Verified
                  </Badge>
                )}
              </h2>
              <Link
                to={`/business/${business.slug}`}
                className="ra-tap inline-flex items-center text-sm font-medium text-primary-text hover:underline"
              >
                View public page
              </Link>
            </div>

            {/*
              The headline fact, stated in words. WhatsApp is the only channel
              this product has, so "can customers reach me" is not a detail on a
              settings screen — it is the dashboard.
            */}
            <Link
              to="/portal/whatsapp"
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                business.routing.deliverable
                  ? "border-border bg-muted/40 hover:bg-accent/40"
                  : "border-destructive/30 bg-destructive/10 hover:bg-destructive/15",
              )}
            >
              <MessageCircle
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  business.routing.deliverable ? "text-success" : "text-destructive",
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                {business.routing.deliverable ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      Booking requests go to {business.routing.label}
                    </p>
                    <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
                      {business.routing.phoneMasked}
                    </p>
                    {business.routing.usedFallback && (
                      <p className="mt-1 text-sm text-warning">
                        Your primary number is switched off, so this one is covering.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Customers can't reach you</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {business.routing.reason === "no_numbers"
                        ? "Add a WhatsApp number to start receiving booking requests."
                        : "Every number is switched off. Switch one back on."}
                    </p>
                  </>
                )}
              </div>
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Profile views"
                value={business.viewCount ?? 0}
                hint="Unique visitors, all time"
              />
              <StatCard
                label="WhatsApp numbers"
                value={`${business.whatsappNumbers.filter((n) => n.isActive).length} of ${business.whatsappNumbers.length || 0}`}
                hint="Active"
                tone={business.routing.deliverable ? "neutral" : "destructive"}
              />
              <StatCard
                label="Rating"
                value={business.averageRating ?? "—"}
                hint={
                  business.reviewCount
                    ? `${business.reviewCount} review${business.reviewCount === 1 ? "" : "s"}`
                    : "No reviews yet"
                }
              />
            </div>
          </section>
        ))
      )}

      {businesses && businesses.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" aria-hidden="true" />
          Booking requests arrive in the next release.
        </p>
      )}
    </div>
  );
}
