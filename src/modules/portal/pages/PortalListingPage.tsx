import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { PageLoader } from "@/shared/components/PageLoader";
import { EmptyState } from "@/shared/components/EmptyState";
import { BusinessForm } from "@/modules/business/components/BusinessForm";
import { useMyBusinesses } from "../hooks/useMyBusiness";

/**
 * My listing — FR-BIZ-01, FR-BIZ-02.
 *
 * The owner's own page, editable. This screen did not exist until Phase 8: an
 * owner could claim a listing and then not change a word of it, because the two
 * requirements that say otherwise had never been assigned to a phase.
 *
 * One business per owner in the MVP. An owner approved for more than one sees the
 * first; multi-site management is a Stage 2 concern and is not faked here.
 */
export function PortalListingPage() {
  const qc = useQueryClient();
  const { data: businesses, isLoading } = useMyBusinesses();

  if (isLoading) return <PageLoader />;

  const business = businesses?.[0];
  if (!business) {
    return (
      <div className="ra-page">
        <EmptyState
          icon={Store}
          title="No business yet"
          description="Claim your listing and you'll be able to edit it here."
          action={
            <Link to="/for-business" className="ra-btn-primary">
              Claim your business
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <BusinessForm
      audience="owner"
      initial={business}
      backTo="/portal"
      backLabel="Overview"
      onSaved={() => {
        // The dashboard checklist and the public page both read this record.
        void qc.invalidateQueries({ queryKey: ["my-businesses"] });
        void qc.invalidateQueries({ queryKey: ["business"] });
        void qc.invalidateQueries({ queryKey: ["businesses"] });
      }}
    />
  );
}
