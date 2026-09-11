import { useNavigate, useParams } from "react-router-dom";
import { PageLoader } from "@/shared/components/PageLoader";
import { SectionCard } from "@/shared/components/SectionCard";
import { BusinessForm } from "@/modules/business/components/BusinessForm";
import { WhatsAppNumbers } from "@/modules/whatsapp/components/WhatsAppNumbers";
import { useAdminBusiness } from "../hooks/useAdmin";

/**
 * Create or edit a listing — FR-ADM-02 and FR-ONB-01. The form lives in
 * `BusinessForm`, shared with the owner's portal. This page adds the one thing
 * only an administrator does here: override a business's WhatsApp numbers.
 */
export function AdminBusinessFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: existing, isLoading } = useAdminBusiness(id);

  if (id && isLoading) return <PageLoader />;

  return (
    <BusinessForm
      audience="admin"
      initial={id ? existing : undefined}
      backTo="/admin/businesses"
      backLabel="Businesses"
      onSaved={() => navigate("/admin/businesses")}
      after={
        // Only on an existing record: numbers belong to a business, and there
        // is nothing to attach them to until it has been created.
        id && existing ? (
          <SectionCard
            id="whatsapp"
            title="WhatsApp numbers"
            description="Changes here are recorded in the audit log and are visible to the owner."
          >
            <WhatsAppNumbers businessId={id} asAdmin />
          </SectionCard>
        ) : undefined
      }
    />
  );
}
