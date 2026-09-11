import { Store } from "lucide-react";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { PageHeader } from "@/shared/components/PageHeader";
import { ButtonLink } from "@/shared/components/Button";
import { WhatsAppNumbers } from "@/modules/whatsapp/components/WhatsAppNumbers";
import { useMyBusinesses } from "../hooks/useMyBusiness";

/**
 * The owner's WhatsApp settings — the most important screen in the portal,
 * since these two rows decide whether this business hears about a customer at
 * all. One section per business rather than a picker: a picker hides the
 * misconfigured one behind a control nobody thinks to open.
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
            <ButtonLink to="/for-business" variant="primary">
              Claim your business
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="ra-page">
      <PageHeader
        title="WhatsApp numbers"
        description="Booking requests are sent to your primary number. If it's switched off, they go to the other one."
      />

      <div className="max-w-3xl space-y-6">
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
    </div>
  );
}
