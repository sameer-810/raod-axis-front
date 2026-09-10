import { useNavigate, useParams } from "react-router-dom";
import { PageLoader } from "@/shared/components/PageLoader";
import { BusinessForm } from "@/modules/business/components/BusinessForm";
import { WhatsAppNumbers } from "@/modules/whatsapp/components/WhatsAppNumbers";
import { useAdminBusiness } from "../hooks/useAdmin";

/**
 * Create or edit a listing — FR-ADM-02 and FR-ONB-01.
 *
 * The form lives in `BusinessForm`, shared with the owner's portal — the same
 * record under the same rules. This page adds the one thing only an
 * administrator does here: override a business's WhatsApp numbers.
 */
export function AdminBusinessFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: existing, isLoading } = useAdminBusiness(id);

  if (id && isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <BusinessForm
        audience="admin"
        initial={id ? existing : undefined}
        backTo="/admin/businesses"
        backLabel="Businesses"
        onSaved={() => navigate("/admin/businesses")}
      />

      {/*
        Only on an existing record: numbers belong to a business, and there is
        nothing to attach them to until it has been created.

        `asAdmin` is what requires a reason before switching somebody else's
        number off — the owner reads that reason in their portal.
      */}
      {id && existing && (
        <section className="ra-tile mx-auto max-w-3xl">
          <h2 className="mb-1 text-sm font-semibold text-foreground">WhatsApp numbers</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Changes here are recorded in the audit log and are visible to the owner.
          </p>
          <WhatsAppNumbers businessId={id} asAdmin />
        </section>
      )}
    </div>
  );
}
