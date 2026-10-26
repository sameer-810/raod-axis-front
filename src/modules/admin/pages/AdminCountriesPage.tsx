import { useState } from "react";
import { Globe2 } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, type Column } from "@/shared/components/DataTable";
import { ConfirmDialog } from "@/shared/components/Dialog";
import { Switch } from "@/shared/components/Switch";
import { EmptyState } from "@/shared/components/EmptyState";
import type { CountryOverview } from "../api/adminApi";
import { useAdminCountries, useSetCountryLive } from "../hooks/useAdmin";

/**
 * Opening and pausing a country — D-043. The client asked for it in the
 * console rather than in the server's settings, so that the people who run
 * the directory can open the UAE the day its garages are ready.
 *
 * Pausing is the one with consequences, so it asks first and says exactly
 * what will disappear. Opening is immediate: nothing is lost by it.
 */
export function AdminCountriesPage() {
  const { data: countries = [], isLoading } = useAdminCountries();
  const setLive = useSetCountryLive();
  const [pausing, setPausing] = useState<CountryOverview | null>(null);

  const openCount = countries.filter((c) => c.live).length;
  /** The last open country cannot be paused: the site would have nothing to show. */
  const isLastOpen = (c: CountryOverview) => c.live && openCount <= 1;

  async function apply(c: CountryOverview, live: boolean) {
    try {
      await setLive.mutateAsync({ code: c.code, live });
      const name = c.shortName.replace(/^the /, "The ");
      toast.success(live ? `${name} is open to the public` : `${name} is paused`);
      setPausing(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function toggle(c: CountryOverview, live: boolean) {
    if (live) void apply(c, true);
    else setPausing(c);
  }

  const status = (c: CountryOverview) =>
    c.live ? <Badge tone="success">Open</Badge> : <Badge tone="warning">Paused</Badge>;

  const listings = (c: CountryOverview) => (
    <span className="text-muted-foreground">
      <span className="font-mono tabular-nums text-foreground">{c.listings.live}</span> live
      {c.listings.total !== c.listings.live && (
        <>
          {" "}
          · <span className="font-mono tabular-nums">{c.listings.total}</span> in total
        </>
      )}
    </span>
  );

  const switchFor = (c: CountryOverview) => (
    <Switch
      checked={c.live}
      onChange={(v) => toggle(c, v)}
      disabled={isLastOpen(c) || setLive.isPending}
      label={c.live ? `Pause ${c.name}` : `Open ${c.name} to the public`}
    />
  );

  const columns: Column<CountryOverview>[] = [
    {
      key: "name",
      header: "Country",
      cell: (c) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{c.name}</span>
          {c.isDefault && <Badge>Default</Badge>}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: status },
    { key: "listings", header: "Listings", hideBelow: "md", cell: listings },
    {
      key: "open",
      header: "Open to the public",
      align: "end",
      width: "10rem",
      cell: (c) => (
        <span className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
          {switchFor(c)}
        </span>
      ),
    },
  ];

  return (
    <div className="ra-page">
      <PageHeader
        title="Countries"
        description="Which countries the public site serves. A paused country disappears from the site, but nothing is deleted, and you can still edit and import its listings here."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{openCount}</span> of{" "}
            <span className="font-mono tabular-nums text-foreground">{countries.length}</span> open
          </span>
        }
      />

      <DataTable
        label="Countries"
        rows={countries}
        columns={columns}
        rowKey={(c) => c.code}
        loading={isLoading}
        density="comfortable"
        minWidth={520}
        empty={
          <EmptyState
            inline
            icon={Globe2}
            title="No countries"
            description="This server serves no countries. Check ENABLED_COUNTRIES."
          />
        }
        mobileRow={(c) => (
          <div className="ra-card flex items-center gap-3 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                {c.name}
                {status(c)}
                {c.isDefault && <Badge>Default</Badge>}
              </p>
              <p className="mt-0.5 text-xs">{listings(c)}</p>
            </div>
            {switchFor(c)}
          </div>
        )}
      />

      <div className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
        {openCount <= 1 && countries.length > 1 && (
          <p>At least one country stays open. To pause this one, open another first.</p>
        )}
        <p>
          A change reaches the site within a minute. Adding a country RoadAxis does not serve yet is
          a development task, not a setting.
        </p>
      </div>

      <ConfirmDialog
        open={Boolean(pausing)}
        onClose={() => setPausing(null)}
        tone="warning"
        title={`Pause ${pausing?.shortName ?? "this country"}?`}
        description={
          pausing ? (
            <>
              The public site stops showing {pausing.shortName} straight away: its{" "}
              {pausing.listings.live} live {pausing.listings.live === 1 ? "listing" : "listings"},
              its search and its garage pages. Owners there cannot register or claim. Nothing is
              deleted, and your team can still edit and import its listings here. Open it again at
              any time.
            </>
          ) : undefined
        }
        confirmLabel={`Pause ${pausing?.shortName.replace(/^the /, "") ?? ""}`.trim()}
        busy={setLive.isPending}
        onConfirm={() => pausing && apply(pausing, false)}
      />
    </div>
  );
}
