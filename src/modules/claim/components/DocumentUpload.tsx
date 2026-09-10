import { useRef, useState } from "react";
import { Upload, FileText, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILES = 3;
const MAX_MB = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,application/pdf";

/**
 * Ownership evidence — the highest-friction step in the whole product: a garage
 * owner on a phone, being asked for a document they may have to go and find. So
 * the copy names exactly what counts, says a phone photo is fine, and the control
 * is a large tap target rather than a default file input.
 *
 * Files are validated before they are sent: a rejection after a 10 MB upload on a
 * workshop's connection is a minute of someone's life for a known answer.
 */
export function DocumentUpload({
  files,
  onChange,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function add(incoming: FileList | null) {
    if (!incoming) return;
    setLocalError(null);
    const next = [...files];

    for (const file of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        setLocalError(`You can attach up to ${MAX_FILES} documents.`);
        break;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setLocalError(`${file.name} is over ${MAX_MB} MB. Try a photo instead of a scan.`);
        continue;
      }
      if (!ACCEPT.split(",").includes(file.type)) {
        setLocalError(`${file.name} isn't a PDF or a photo.`);
        continue;
      }
      next.push(file);
    }
    onChange(next);
    // Clear the input, or choosing the same file twice in a row does nothing.
    if (inputRef.current) inputRef.current.value = "";
  }

  const message = error ?? localError;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Proof you run this business</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A business licence, a tax document, or a recent utility bill in the business's name. A
          clear photo taken on your phone is fine.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors",
          message
            ? "border-destructive/50"
            : "border-border hover:border-primary hover:bg-accent/40",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-foreground">
          {files.length ? "Add another document" : "Choose a document"}
        </span>
        <span className="text-xs text-muted-foreground">PDF or photo · up to {MAX_MB} MB each</span>
      </button>

      {/*
        Hidden from assistive technology as well as from sight.

        The button above is the control: it is what a keyboard reaches, what a
        screen reader announces, and what a thumb can actually hit. Leaving this
        input in the accessibility tree with its own label meant the same action
        was announced twice — and a 1px input was being counted as a touch
        target it could never be.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={(e) => add(e.target.files)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{file.name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${file.name}`}
                className="ra-tap flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      )}
    </div>
  );
}

export { MAX_FILES, MAX_MB };
