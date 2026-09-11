import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Download,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { http, getApiErrorMessage } from "@/shared/api/http";
import { Stat, StatGroup } from "@/shared/components/StatGroup";
import { PageHeader } from "@/shared/components/PageHeader";
import { Stepper } from "@/shared/components/Stepper";
import { SectionCard } from "@/shared/components/SectionCard";
import { Button } from "@/shared/components/Button";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { DataTable, type Column } from "@/shared/components/DataTable";
import { EmptyState } from "@/shared/components/EmptyState";
import { toast } from "@/shared/lib/toast";

interface RowResult {
  line: number;
  name: string;
  status: "created" | "valid" | "skipped" | "failed";
  message: string;
  slug?: string;
}

interface ImportSummary {
  dryRun: boolean;
  total: number;
  created?: number;
  valid?: number;
  skipped: number;
  failed: number;
  results: RowResult[];
}

/**
 * The template, built here rather than downloaded: the API's copy is behind
 * `authenticate`, and a plain `<a href>` would download a 401 as a file.
 */
function downloadTemplate() {
  const header =
    "name,description,categories,custom_services,line1,line2,city,postcode,latitude,longitude,phone,email,website\n";
  const url = URL.createObjectURL(new Blob([header], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "roadaxis-listings-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const COLUMNS = [
  ["name", "Required. The business's trading name."],
  ["categories", "Comma-separated category slugs, e.g. tyres,mot."],
  ["line1, city, postcode", "The address. A UK postcode is enough to place it."],
  ["latitude, longitude", "Optional — looked up from the postcode when absent."],
  ["phone, email, website", "Optional contact details."],
  ["description, custom_services", "Optional."],
];

const STEPS = [
  { label: "Choose a CSV", description: "One row per listing" },
  { label: "Preview", description: "Every row checked, nothing written" },
  { label: "Import", description: "The rows that passed go live" },
];

/**
 * Bulk listing import — FR-ADM-09. The most destructive screen in the product,
 * so the flow is preview-then-commit and the preview is not a summary: it is the
 * same parsing, validation and duplicate check, reported row by row.
 */
export function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [show, setShow] = useState<"all" | "failed" | "skipped" | "ok">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(commit: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (commit) form.append("commit", "true");
      const res = await http.post<{ data: ImportSummary; message: string }>(
        "/import/businesses",
        form,
      );
      setSummary(res.data.data);
      setShow("all");
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function choose(f: File | null) {
    setFile(f);
    setSummary(null);
  }

  const ready = summary?.dryRun ? (summary.valid ?? 0) : 0;
  const committed = summary ? !summary.dryRun : false;
  const step = committed ? 3 : summary ? 2 : file ? 1 : 0;

  const rows = (summary?.results ?? []).filter((r) =>
    show === "all"
      ? true
      : show === "failed"
        ? r.status === "failed"
        : show === "skipped"
          ? r.status === "skipped"
          : r.status === "valid" || r.status === "created",
  );

  const columns: Column<RowResult>[] = [
    {
      key: "line",
      header: "Line",
      width: "4rem",
      cell: (r) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.line}</span>
      ),
    },
    {
      key: "name",
      header: "Name",
      cell: (r) =>
        r.slug ? (
          <Link to={`/business/${r.slug}`} className="font-medium text-foreground hover:underline">
            {r.name}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{r.name}</span>
        ),
    },
    {
      key: "status",
      header: "Result",
      width: "8rem",
      cell: (r) => <RowStatus status={r.status} />,
    },
    {
      key: "message",
      header: "Detail",
      wrap: true,
      cell: (r) => <span className="text-muted-foreground">{r.message}</span>,
    },
  ];

  return (
    <div className="ra-page">
      <PageHeader
        title="Import listings"
        description="Seed the directory from a spreadsheet. Nothing is written until you have seen the preview and pressed a second button."
      >
        <Stepper steps={STEPS} current={step} className="pt-1" />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="1. Choose a CSV"
          id="upload"
          aside={
            <Button variant="ghost" size="sm" icon={Download} onClick={downloadTemplate}>
              Download the column template
            </Button>
          }
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              dragging ? "border-primary bg-primary/[0.06]" : "border-border bg-surface-2",
            )}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-6 w-6 text-primary-text" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                    Choose a different file
                  </Button>
                  <Button size="sm" variant="ghost" icon={X} onClick={() => choose(null)}>
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-foreground">Drop a CSV here, or</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  onClick={() => inputRef.current?.click()}
                >
                  Choose file
                </Button>
              </>
            )}
            {/* tabIndex={-1} and aria-hidden, or this input duplicates the button's name. */}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </div>

          <details className="mt-4">
            <summary className="ra-control inline-flex cursor-pointer items-center text-[13px] text-muted-foreground hover:text-foreground">
              What the columns mean
            </summary>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {COLUMNS.map(([name, meaning]) => (
                <div key={name} className="flex flex-wrap gap-x-2">
                  <dt className="font-mono text-xs text-foreground">{name}</dt>
                  <dd className="text-muted-foreground">{meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        </SectionCard>

        <SectionCard
          title="2. Preview"
          id="preview"
          description="Checks every row against the same rules a listing typed by hand has to meet, and against what is already in the directory."
        >
          <Button
            variant={file && !summary ? "primary" : "secondary"}
            disabled={!file}
            loading={busy && !committed}
            onClick={() => send(false)}
          >
            Check the file
          </Button>
          {!file && <p className="mt-2 text-xs text-muted-foreground">Choose a file first.</p>}
        </SectionCard>
      </div>

      {summary && (
        <>
          <StatGroup columns={4}>
            <Stat label="Rows" value={summary.total} />
            <Stat
              label={summary.dryRun ? "Ready" : "Created"}
              value={summary.dryRun ? (summary.valid ?? 0) : (summary.created ?? 0)}
              tone="success"
            />
            <Stat
              label="Already listed"
              value={summary.skipped}
              tone={summary.skipped ? "warning" : "neutral"}
              hint="Skipped as duplicates"
            />
            <Stat
              label="Problems"
              value={summary.failed}
              tone={summary.failed ? "destructive" : "neutral"}
              hint={summary.failed ? "Fix the cells named below and check again" : undefined}
            />
          </StatGroup>

          {summary.dryRun && (
            <SectionCard
              title="3. Import"
              id="commit"
              description={
                ready > 0
                  ? `${ready} listing${ready === 1 ? "" : "s"} will go live immediately, unclaimed and unverified. Rows with problems are left out.`
                  : "Nothing in this file is ready to import yet."
              }
            >
              <Button
                variant="primary"
                disabled={ready === 0}
                loading={busy}
                onClick={() => send(true)}
              >
                {`Import ${ready} listing${ready === 1 ? "" : "s"}`}
              </Button>
            </SectionCard>
          )}

          <section aria-labelledby="rows" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="rows" className="text-sm font-semibold text-foreground">
                Row by row
              </h2>
              <SegmentedControl
                label="Show rows"
                size="sm"
                value={show}
                onChange={setShow}
                options={[
                  { value: "all", label: "All" },
                  { value: "ok", label: summary.dryRun ? "Ready" : "Listed" },
                  { value: "skipped", label: "Skipped" },
                  { value: "failed", label: "Problems" },
                ]}
              />
            </div>
            {/*
              A real table at every width, deliberately — no `mobileRow`. This
              is a report read once, and its whole value is the line numbers
              lining up against the file open in another window. Cards would
              give that up to save a sideways scroll on a screen almost nobody
              imports a spreadsheet from.
            */}
            <DataTable
              label="Import results"
              rows={rows}
              columns={columns}
              rowKey={(r) => `${r.line}-${r.name}`}
              density="compact"
              stickyFirstColumn={false}
              minWidth={560}
              empty={<EmptyState inline title="No rows in this group" />}
            />
          </section>
        </>
      )}
    </div>
  );
}

function RowStatus({ status }: { status: RowResult["status"] }) {
  const map = {
    created: { icon: CheckCircle2, label: "Listed", tone: "text-success" },
    valid: { icon: CheckCircle2, label: "Ready", tone: "text-success" },
    skipped: { icon: MinusCircle, label: "Skipped", tone: "text-warning-text" },
    failed: { icon: XCircle, label: "Problem", tone: "text-destructive" },
  } as const;
  const { icon: Icon, label, tone } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", tone)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );
}
