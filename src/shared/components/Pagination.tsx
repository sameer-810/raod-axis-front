import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

/**
 * "Showing 1–20 of 167", and the two buttons. Always the total — "page 3 of ?"
 * is a list with no sense of place.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  labels = { prev: "Previous", next: "Next" },
  noun = "results",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  labels?: { prev: string; next: string };
  noun?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
      <p>
        Showing{" "}
        <span className="font-mono tabular-nums text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="font-mono tabular-nums text-foreground">{total}</span> {noun}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            {labels.prev}
          </Button>
          <span className="px-2 font-mono text-xs tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            {labels.next}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
