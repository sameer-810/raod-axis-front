import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Ban, RotateCcw, Pencil, ExternalLink, Store, BadgeCheck } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Button, ButtonLink } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { FilterBar, FilterSelect } from "@/shared/components/FilterBar";
import { DataTable, DensityToggle, type Column } from "@/shared/components/DataTable";
import { Pagination } from "@/shared/components/Pagination";
import { EmptyState } from "@/shared/components/EmptyState";
import { RecordCard } from "@/shared/components/RecordCard";
import { RowMenu } from "@/shared/components/Menu";
import { ConfirmDialog } from "@/shared/components/Dialog";
import { Fab } from "@/shared/components/Fab";
import { useDensity } from "@/shared/hooks/useDensity";
import { formatDate } from "@/shared/lib/format";
import { useAdminBusinesses, useSetBusinessStatus } from "../hooks/useAdmin";
import type { BusinessCard } from "@/modules/business/types";

type Visibility = "" | "draft" | "live" | "suspended";
type Ownership = "" | "unclaimed" | "pending" | "claimed";

const VISIBILITY = [
  { value: "", label: "All visibility" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "suspended", label: "Suspended" },
];
const OWNERSHIP = [
  { value: "", label: "All ownership" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "pending", label: "Claim pending" },
  { value: "claimed", label: "Claimed" },
];

/**
 * The directory, as an administrator sees it. The one screen showing all three
 * states at once — visibility, ownership and trust — because they are
 * independent, and the interesting records are the ones where they disagree.
 */
export function AdminBusinessesPage() {
  const navigate = useNavigate();
  const [density, setDensity] = useDensity();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Visibility>("");
  const [claimStatus, setClaimStatus] = useState<Ownership>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suspending, setSuspending] = useState<BusinessCard[] | null>(null);

  const { data, isLoading, isFetching } = useAdminBusinesses({
    search,
    status: status || undefined,
    claimStatus: claimStatus || undefined,
    page,
  });
  const setBusinessStatus = useSetBusinessStatus();
  const items = data?.items ?? [];

  const resetPage = () => {
    setPage(1);
    setSelected(new Set());
  };

  async function suspend(list: BusinessCard[], reason: string) {
    try {
      for (const b of list) {
        await setBusinessStatus.mutateAsync({ id: b.id, status: "suspended", reason });
      }
      toast.success(
        list.length === 1 ? `${list[0].name} suspended` : `${list.length} listings suspended`,
      );
      setSuspending(null);
      setSelected(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function restore(list: BusinessCard[]) {
    try {
      for (const b of list) await setBusinessStatus.mutateAsync({ id: b.id, status: "live" });
      toast.success(
        list.length === 1 ? `${list[0].name} is live again` : `${list.length} listings restored`,
      );
      setSelected(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  const byId = (ids: string[]) => items.filter((b) => ids.includes(b.id));

  const rowActions = (b: BusinessCard) => [
    { label: "Edit listing", icon: Pencil, onSelect: () => navigate(`/admin/businesses/${b.id}`) },
    { label: "View public page", icon: ExternalLink, href: `/business/${b.slug}`, external: true },
    { type: "separator" as const },
    // Only the move this listing can actually make.
    ...(b.status === "live"
      ? [
          {
            label: "Suspend listing",
            icon: Ban,
            destructive: true,
            onSelect: () => setSuspending([b]),
          },
        ]
      : [
          {
            label: b.status === "draft" ? "Publish now" : "Restore to live",
            icon: RotateCcw,
            onSelect: () => void restore([b]),
          },
        ]),
  ];

  const columns: Column<BusinessCard>[] = [
    {
      key: "name",
      header: "Business",
      sortable: false,
      wrap: true,
      cell: (b) => (
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={`/admin/businesses/${b.id}`}
            className="ra-focus truncate rounded font-medium text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {b.name}
          </Link>
          {b.isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Verified" />
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (b) => (
        <span className="text-muted-foreground">
          {b.address.city}
          {b.address.postcode && (
            <span className="ms-1.5 font-mono text-xs tabular-nums">{b.address.postcode}</span>
          )}
        </span>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      hideBelow: "lg",
      cell: (b) => (
        <span className="text-muted-foreground">
          {b.categories.map((c) => c.name).join(", ") || "—"}
        </span>
      ),
    },
    { key: "state", header: "State", cell: (b) => <StatusBadges business={b} /> },
    {
      key: "listed",
      header: "Listed",
      align: "end",
      hideBelow: "xl",
      cell: (b) => (
        <span className="text-xs text-muted-foreground">{formatDate(b.listedAt) || "—"}</span>
      ),
    },
  ];

  const chips = [
    status && {
      key: "status",
      label: `Visibility: ${VISIBILITY.find((v) => v.value === status)?.label}`,
      onRemove: () => {
        setStatus("");
        resetPage();
      },
    },
    claimStatus && {
      key: "claim",
      label: `Ownership: ${OWNERSHIP.find((v) => v.value === claimStatus)?.label}`,
      onRemove: () => {
        setClaimStatus("");
        resetPage();
      },
    },
  ].filter((c): c is { key: string; label: string; onRemove: () => void } => Boolean(c));

  return (
    <div className="ra-page">
      <PageHeader
        title="Businesses"
        description="Every listing in the directory — live, draft and suspended — with who owns it and whether we vouch for it."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{data?.meta.total ?? 0}</span>{" "}
            listings
            {isFetching && !isLoading && (
              <span className="ms-2 text-muted-foreground/70">· updating</span>
            )}
          </span>
        }
        actions={
          <ButtonLink
            to="/admin/businesses/new"
            variant="primary"
            icon={Plus}
            className="hidden md:inline-flex"
          >
            New listing
          </ButtonLink>
        }
      />

      <FilterBar
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            resetPage();
          },
          placeholder: "Search by name, city or postcode",
          label: "Search listings",
        }}
        chips={chips}
        onClearAll={
          chips.length
            ? () => {
                setStatus("");
                setClaimStatus("");
                resetPage();
              }
            : undefined
        }
        trailing={<DensityToggle density={density} onChange={setDensity} />}
      >
        <FilterSelect
          id="status"
          label="Visibility"
          value={status}
          onChange={(v) => {
            setStatus(v as Visibility);
            resetPage();
          }}
          options={VISIBILITY}
        />
        <FilterSelect
          id="claim"
          label="Ownership"
          value={claimStatus}
          onChange={(v) => {
            setClaimStatus(v as Ownership);
            resetPage();
          }}
          options={OWNERSHIP}
        />
      </FilterBar>

      <DataTable
        label="Businesses"
        rows={items}
        columns={columns}
        rowKey={(b) => b.id}
        loading={isLoading}
        density={density}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        bulkActions={(ids) => (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              onClick={() => void restore(byId(ids))}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="danger-outline"
              icon={Ban}
              onClick={() => setSuspending(byId(ids))}
            >
              Suspend
            </Button>
          </>
        )}
        onRowClick={(b) => navigate(`/admin/businesses/${b.id}`)}
        rowActions={rowActions}
        rowActionsLabel={(b) => `Actions for ${b.name}`}
        empty={
          <EmptyState
            inline
            icon={Store}
            title={search || chips.length ? "No listings match" : "No listings yet"}
            description={
              search || chips.length
                ? "Try a different search, or clear the filters."
                : "Seed the directory by hand or from a spreadsheet."
            }
            action={
              !search && !chips.length ? (
                <ButtonLink to="/admin/businesses/import" variant="secondary">
                  Import listings
                </ButtonLink>
              ) : undefined
            }
          />
        }
        mobileRow={(b) => (
          <RecordCard
            title={b.name}
            to={`/admin/businesses/${b.id}`}
            meta={[b.address.city, b.categories.map((c) => c.name).join(", ")]}
            badge={<StatusBadges business={b} />}
            actions={
              <RowMenu
                items={rowActions(b)}
                label={`Actions for ${b.name}`}
                size="md"
                variant="secondary"
              />
            }
          />
        )}
        footer={
          data && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              pageSize={data.meta.limit || 20}
              onChange={setPage}
              noun="listings"
            />
          )
        }
      />

      <Fab label="New listing" onClick={() => navigate("/admin/businesses/new")} />

      <ConfirmDialog
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        title={
          suspending?.length === 1
            ? `Suspend ${suspending[0].name}?`
            : `Suspend ${suspending?.length ?? 0} listings?`
        }
        description="It disappears from public search immediately. Nothing is deleted, and it can be restored."
        confirmLabel="Suspend"
        busy={setBusinessStatus.isPending}
        onConfirm={(reason) => suspending && suspend(suspending, reason)}
        reason={{
          label: "Reason",
          placeholder: "e.g. Reported as a fake listing",
          hint: "Recorded in the audit log.",
          minLength: 3,
        }}
      />
    </div>
  );
}

/**
 * The three states, and only the ones worth saying. `live` and `claimed` are the
 * ordinary case and get no badge — a screen where every row is decorated has no
 * signal in it.
 */
function StatusBadges({ business }: { business: BusinessCard }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {business.status === "draft" && <Badge tone="warning">Draft</Badge>}
      {business.status === "suspended" && <Badge tone="destructive">Suspended</Badge>}
      {business.isVerified && <Badge tone="success">Verified</Badge>}
      {business.claimStatus === "unclaimed" && <Badge>Unclaimed</Badge>}
      {business.claimStatus === "pending" && <Badge tone="warning">Claim pending</Badge>}
    </div>
  );
}
