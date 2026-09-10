import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { WhatsAppNumbers } from "@/modules/whatsapp/components/WhatsAppNumbers";
import { useMyBusinesses } from "../hooks/useMyBusiness";

/**
 * The owner's WhatsApp settings — the most important screen in the portal, since
 * these two rows decide whether this business hears about a customer at all.
 *
 * An owner with several garages gets one section each rather than a picker: a
 * picker hides the misconfigured one behind a control nobody thinks to open.
 */
export function PortalWhatsAppPage() {
  const { data: businesses, isLoading } = useMyBusinesses();

  if (isLoading) return <PageLoader />;

  if (!businesses || businesses.length === 0) {
    return (
      <div className="ra-page">
        <EmptyState
          icon={Store}
          title="No business yet"
          description="Once your claim is approved, your listing appears here and you can set up the numbers customers reach you on."
          action={
            <Link
              to="/for-business"
              className="ra-tap flex items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Claim your business
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="ra-page">
      <div>
        <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
          WhatsApp numbers
        </h1>
        <p className="text-sm text-muted-foreground">
          Booking requests are sent to your primary number. If it's switched off, they go to the
          other one.
        </p>
      </div>

      {businesses.map((business) => (
        <section key={business.id} aria-labelledby={`wa-${business.id}`} className="space-y-3">
          {businesses.length > 1 && (
            <h2 id={`wa-${business.id}`} className="text-base font-semibold text-foreground">
              {business.name}
            </h2>
          )}
          <WhatsAppNumbers businessId={business.id} />
        </section>
      ))}
    </div>
  );
}
