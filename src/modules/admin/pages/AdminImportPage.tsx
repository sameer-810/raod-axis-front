import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { http, getApiErrorMessage } from "@/shared/api/http";
import { StatCard } from "@/shared/components/StatCard";
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
 * The template, built here rather than downloaded.
 *
 * The API serves the same header line, but it is behind `authenticate` — and a
 * plain `<a href>` carries no Authorization header, so that link would download
 * a 401 as a file. The one place the columns are defined for real is the
 * importer; this is a convenience copy and the API's own row-by-row messages are
 * what catch a drift between them.
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

/**
 * Bulk listing import — FR-ADM-09.
 *
 * The most destructive screen in the product: one bad file puts several hundred
 * wrong records in front of the public at once. So the flow is preview-then-
 * commit, and the preview is not a summary — it is the same parsing, the same
 * validation and the same duplicate check the real run does, reported row by row
 * with line numbers. Nothing is written until somebody has seen that and pressed
 * a second button.
 */
export function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
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
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = summary?.dryRun ? (summary.valid ?? 0) : 0;

  return (
    <div className="ra-page">
      <div>
        <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
          Import listings
        </h1>
        <p className="text-sm text-muted-foreground">
          Seed the directory from a spreadsheet. Nothing is written until you have seen the
          preview.
        </p>
      </div>

      <section aria-labelledby="upload" className="ra-panel p-4">
        <h2 id="upload" className="text-base font-semibold text-foreground">
          1. Choose a CSV
        </h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ra-tap flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {file ? "Choose a different file" : "Choose file"}
          </button>
          {/*
            tabIndex={-1} and aria-hidden, or this input duplicates the button's
            accessible name and a screen reader announces the control twice.
          */}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setSummary(null);
            }}
          />
          {file && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {file.name}
            </span>
          )}
          <button
            type="button"
            onClick={downloadTemplate}
            className="ra-tap ms-auto flex items-center text-sm text-primary-text hover:underline"
          >
            Download the column template
          </button>
        </div>

        <details className="mt-4">
          <summary className="ra-tap inline-flex cursor-pointer items-center text-sm text-muted-foreground">
            What the columns mean
          </summary>
          <dl className="mt-2 space-y-1.5 text-sm">
            {COLUMNS.map(([name, meaning]) => (
              <div key={name} className="flex flex-wrap gap-x-2">
                <dt className="font-mono text-xs text-foreground">{name}</dt>
                <dd className="text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="preview" className="ra-panel p-4">
        <h2 id="preview" className="text-base font-semibold text-foreground">
          2. Preview
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Checks every row against the same rules a listing typed by hand has to meet, and
          against what is already in the directory.
        </p>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => send(false)}
          className="ra-tap mt-3 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check the file"}
        </button>
      </section>

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Rows" value={summary.total} />
            <StatCard
              label={summary.dryRun ? "Ready" : "Created"}
              value={summary.dryRun ? (summary.valid ?? 0) : (summary.created ?? 0)}
              tone="success"
            />
            <StatCard
              label="Already listed"
              value={summary.skipped}
              tone={summary.skipped ? "warning" : "neutral"}
              hint="Skipped as duplicates"
            />
            <StatCard
              label="Problems"
              value={summary.failed}
              tone={summary.failed ? "destructive" : "neutral"}
            />
          </div>

          {summary.dryRun && (
            <section aria-labelledby="commit" className="ra-panel p-4">
              <h2 id="commit" className="text-base font-semibold text-foreground">
                3. Import
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ready > 0
                  ? `${ready} listing${ready === 1 ? "" : "s"} will go live immediately, unclaimed and unverified. Rows with problems are left out.`
                  : "Nothing in this file is ready to import yet."}
              </p>
              <button
                type="button"
                disabled={ready === 0 || busy}
                onClick={() => send(true)}
                className="ra-tap mt-3 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Importing…" : `Import ${ready} listing${ready === 1 ? "" : "s"}`}
              </button>
            </section>
          )}

          <section aria-labelledby="rows">
            <h2 id="rows" className="mb-3 text-base font-semibold text-foreground">
              Row by row
            </h2>
            {/* The line number is the only way back to the cell that is wrong. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                    <th scope="col" className="py-2 pe-3 font-medium">
                      Line
                    </th>
                    <th scope="col" className="py-2 pe-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="py-2 pe-3 font-medium">
                      Result
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.results.map((row) => (
                    <tr key={`${row.line}-${row.name}`}>
                      <td className="py-2 pe-3 font-mono tabular-nums text-muted-foreground">
                        {row.line}
                      </td>
                      <td className="py-2 pe-3">
                        {row.slug ? (
                          <Link to={`/business/${row.slug}`} className="hover:underline">
                            {row.name}
                          </Link>
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className="py-2 pe-3">
                        <RowStatus status={row.status} />
                      </td>
                      <td className="py-2 text-muted-foreground">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    skipped: { icon: MinusCircle, label: "Skipped", tone: "text-warning" },
    failed: { icon: XCircle, label: "Problem", tone: "text-destructive" },
  } as const;
  const { icon: Icon, label, tone } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", tone)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </span>
  );
}
