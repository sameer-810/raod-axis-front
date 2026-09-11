import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Rows3, StretchHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import type { Density } from "@/shared/hooks/useDensity";
import { SkeletonRows } from "./Skeleton";
import { RowMenu, type MenuEntry } from "./Menu";
import { Button } from "./Button";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Numbers and dates right-align, so digits line up by place value. */
  align?: "start" | "end";
  width?: string;
  sortable?: boolean;
  className?: string;
  /** Drop this column below a breakpoint rather than letting the table scroll. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Text-only columns truncate; the one description column may wrap. */
  wrap?: boolean;
}

export interface Sort {
  key: string;
  dir: "asc" | "desc";
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/**
 * The table every list screen is built on.
 *
 * Semantic `<table>`, sticky header, a frozen first column with a shadow, sort
 * indicators that are always visible on the active column, row selection with a
 * bulk-action bar that replaces the toolbar, a trailing kebab for row actions
 * (never hover-only — invisible to keyboard and touch), skeleton rows at the real
 * row height, and an empty state inside the frame. Keyboard: ↑↓ move between
 * rows, Enter opens, Space selects. Below `md` each row becomes the caller's
 * `mobileRow`, because a table at 390px is sideways panning with none of a
 * table's benefit.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  skeletonRows = 8,
  empty,
  onRowClick,
  rowActions,
  rowActionsLabel = (row) => `Actions for ${rowKey(row)}`,
  selectable,
  selected,
  onSelectedChange,
  bulkActions,
  sort,
  onSortChange,
  density = "comfortable",
  stickyFirstColumn = true,
  mobileRow,
  footer,
  label,
  rowTone,
  minWidth = 720,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => MenuEntry[];
  rowActionsLabel?: (row: T) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Shown in the bar that appears once something is selected. */
  bulkActions?: (ids: string[]) => React.ReactNode;
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
  density?: Density;
  stickyFirstColumn?: boolean;
  mobileRow?: (row: T) => React.ReactNode;
  footer?: React.ReactNode;
  /** The accessible name of the table. */
  label: string;
  /** A left accent on rows that need acting on. */
  rowTone?: (row: T) => "attention" | "danger" | undefined;
  minWidth?: number;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 0);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const interactive = Boolean(onRowClick);
  const ids = rows.map(rowKey);
  const allSelected = selectable && ids.length > 0 && ids.every((id) => selected?.has(id));
  const someSelected = selectable && ids.some((id) => selected?.has(id));

  const toggleAll = () => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onSelectedChange(next);
  };
  const toggleOne = (id: string) => {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  /**
   * ↑↓ between rows, Enter opens, Space selects.
   *
   * Only when the row itself has focus. Without that guard the keydown from a
   * checkbox or the row's own action menu bubbles up here, and pressing Enter
   * to open the menu opened the record instead.
   */
  const onRowKey = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
      const tr = e.currentTarget;
      if (e.target !== tr) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const sibling =
          e.key === "ArrowDown"
            ? (tr.nextElementSibling as HTMLElement | null)
            : (tr.previousElementSibling as HTMLElement | null);
        sibling?.focus();
      } else if (e.key === "Enter" && onRowClick) {
        e.preventDefault();
        onRowClick(row);
      } else if (e.key === " " && selectable) {
        e.preventDefault();
        toggleOne(rowKey(row));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRowClick, selectable, selected],
  );

  const selectedIds = selected ? Array.from(selected) : [];
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const sortIcon = (col: Column<T>) => {
    if (!col.sortable) return null;
    if (sort?.key !== col.key)
      return (
        <ArrowUpDown
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
          aria-hidden="true"
        />
      );
    return sort.dir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-foreground" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3 text-foreground" aria-hidden="true" />
    );
  };

  const bulkBar = selectable && selectedIds.length > 0 && (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/[0.06] px-4 py-2"
      role="region"
      aria-label="Selected rows"
      aria-live="polite"
    >
      <p className="text-[13px] font-medium text-foreground">
        <span className="font-mono tabular-nums">{selectedIds.length}</span> selected
      </p>
      <div className="flex flex-wrap items-center gap-1.5">{bulkActions?.(selectedIds)}</div>
      <Button
        variant="ghost"
        size="sm"
        className="ms-auto"
        onClick={() => onSelectedChange?.(new Set())}
      >
        Clear
      </Button>
    </div>
  );

  // ── Phone: cards ─────────────────────────────────────────────────────────
  if (isMobile && mobileRow) {
    return (
      <div className={cn("space-y-2", className)}>
        {bulkBar && <div className="ra-panel overflow-hidden">{bulkBar}</div>}
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ra-card p-3.5">
                <div className="ra-skeleton h-4 w-2/3" />
                <div className="ra-skeleton mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          empty
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={rowKey(row)}>{mobileRow(row)}</li>
            ))}
          </ul>
        )}
        {footer && rows.length > 0 && <div className="pt-1">{footer}</div>}
      </div>
    );
  }

  // ── Desktop: the table ───────────────────────────────────────────────────
  return (
    <div className={cn("ra-panel overflow-hidden", className)}>
      {bulkBar}
      <div
        ref={scrollRef}
        className="ra-table-scroll relative max-h-[calc(100vh-18rem)] min-h-[12rem] overflow-auto"
        data-scrolled={scrolled}
      >
        <table
          className="ra-table"
          data-density={density}
          aria-label={label}
          style={{ minWidth: rows.length ? minWidth : undefined }}
          aria-busy={loading || undefined}
        >
          <thead className="sticky top-0 z-[2]">
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className="w-10 !ps-3 pe-0"
                  data-sticky={stickyFirstColumn || undefined}
                >
                  <label className="flex h-9 w-6 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(allSelected)}
                      ref={(el) => {
                        if (el) el.indeterminate = Boolean(someSelected && !allSelected);
                      }}
                      onChange={toggleAll}
                      aria-label="Select all rows"
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  </label>
                </th>
              )}
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  scope="col"
                  data-sticky={(stickyFirstColumn && i === 0 && !selectable) || undefined}
                  aria-sort={
                    col.sortable && sort?.key === col.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    col.align === "end" && "text-end",
                    col.hideBelow && HIDE[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange({
                          key: col.key,
                          dir: sort?.key === col.key && sort.dir === "asc" ? "desc" : "asc",
                        })
                      }
                      className={cn(
                        "ra-focus group -mx-1 inline-flex h-7 items-center gap-1 rounded px-1 uppercase tracking-[0.06em] hover:text-foreground",
                        col.align === "end" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      {sortIcon(col)}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="w-12">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {loading ? (
              <SkeletonRows rows={skeletonRows} columns={colCount} density={density} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="!h-auto !border-b-0 !p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                const isSelected = Boolean(selected?.has(id));
                return (
                  <tr
                    key={id}
                    data-interactive={interactive || undefined}
                    data-selected={isSelected || undefined}
                    data-tone={rowTone?.(row)}
                    tabIndex={interactive || selectable ? 0 : undefined}
                    onClick={interactive ? () => onRowClick?.(row) : undefined}
                    onKeyDown={interactive || selectable ? (e) => onRowKey(e, row) : undefined}
                  >
                    {selectable && (
                      <td
                        className="w-10 !ps-3 pe-0"
                        data-sticky={stickyFirstColumn || undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="flex h-full w-6 cursor-pointer items-center justify-center py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(id)}
                            aria-label={`Select row ${id}`}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                        </label>
                      </td>
                    )}
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        data-sticky={(stickyFirstColumn && i === 0 && !selectable) || undefined}
                        className={cn(
                          col.align === "end" && "text-end font-mono tabular-nums",
                          !col.wrap && "max-w-[18rem] truncate",
                          col.hideBelow && HIDE[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="w-12 !pe-2 text-end" onClick={(e) => e.stopPropagation()}>
                        <RowMenu items={rowActions(row)} label={rowActionsLabel(row)} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer && (rows.length > 0 || loading) && (
        <div className="border-t border-border bg-surface-2 px-4 py-2.5">{footer}</div>
      )}
    </div>
  );
}

/** Compact / comfortable toggle, for the filter bar's trailing slot. */
export function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div className="ra-segmented" role="group" aria-label="Row density">
      <button
        type="button"
        aria-pressed={density === "compact"}
        onClick={() => onChange("compact")}
        className="ra-segment !px-2"
        title="Compact rows"
      >
        <Rows3 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Compact</span>
      </button>
      <button
        type="button"
        aria-pressed={density === "comfortable"}
        onClick={() => onChange("comfortable")}
        className="ra-segment !px-2"
        title="Comfortable rows"
      >
        <StretchHorizontal className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Comfortable</span>
      </button>
    </div>
  );
}
