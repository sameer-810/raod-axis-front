import { useState } from "react";
import { Plus, Trash2, Lightbulb, Tags } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Field } from "@/shared/components/Field";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { DataTable, type Column } from "@/shared/components/DataTable";
import { Dialog, ConfirmDialog } from "@/shared/components/Dialog";
import { SectionCard } from "@/shared/components/SectionCard";
import { Switch } from "@/shared/components/Switch";
import { EmptyState } from "@/shared/components/EmptyState";
import { RowMenu } from "@/shared/components/Menu";
import { CategoryIcon } from "@/shared/components/CategoryIcon";
import type { Category } from "@/modules/business/types";
import {
  useAdminCategories,
  useCategorySuggestions,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../hooks/useAdmin";

/**
 * Category management — FR-ADM-05. Two halves, and the second is the
 * interesting one: the managed taxonomy, and what businesses have typed into
 * "mention your service" because it did not cover them. A term appearing
 * eleven times is an argument for a category; one appearing once is not.
 */
export function AdminCategoriesPage() {
  const { data: categories = [], isLoading } = useAdminCategories();
  const { data: suggestions = [] } = useCategorySuggestions();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim() });
      toast.success(`${name.trim()} added`);
      setName("");
      setOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function toggle(c: Category, isActive: boolean) {
    try {
      await update.mutateAsync({ id: c.id, payload: { isActive } });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function destroy(c: Category) {
    try {
      await remove.mutateAsync(c.id);
      toast.success(`${c.name} deleted`);
      setDeleting(null);
    } catch (err) {
      // The server refuses when businesses are using it and names the count.
      toast.error(getApiErrorMessage(err));
      setDeleting(null);
    }
  }

  const columns: Column<Category>[] = [
    {
      key: "order",
      header: "#",
      width: "3rem",
      cell: (c) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.sortOrder}</span>
      ),
    },
    {
      key: "name",
      header: "Category",
      wrap: true,
      cell: (c) => (
        <span className="flex items-center gap-2.5">
          <span className="ra-service-icon h-7 w-7 rounded-md">
            <CategoryIcon name={c.icon ?? c.name} className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-foreground">{c.name}</span>
          {!c.isActive && <Badge tone="warning">Hidden</Badge>}
        </span>
      ),
    },
    {
      key: "slug",
      header: "URL",
      hideBelow: "md",
      cell: (c) => (
        <span className="font-mono text-xs text-muted-foreground">/search?category={c.slug}</span>
      ),
    },
    {
      key: "shown",
      header: "Shown",
      align: "end",
      width: "6rem",
      cell: (c) => (
        <span className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={c.isActive}
            onChange={(v) => void toggle(c, v)}
            label={`Show ${c.name} publicly`}
          />
        </span>
      ),
    },
  ];

  const max = Math.max(...suggestions.map((s) => s.count), 1);

  const form = (
    <form onSubmit={add} className="space-y-1">
      <Field
        label="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Windscreens"
        hint="The URL is generated from the name and stays fixed if you rename it later."
        error={error ?? undefined}
        data-autofocus
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending}>
          Add category
        </Button>
      </div>
    </form>
  );

  return (
    <div className="ra-page">
      <PageHeader
        title="Categories"
        description="The service taxonomy drivers filter by. Changes reach the public filter immediately."
        meta={
          <span>
            <span className="font-mono tabular-nums text-foreground">{categories.length}</span>{" "}
            categories ·{" "}
            <span className="font-mono tabular-nums text-foreground">
              {categories.filter((c) => c.isActive).length}
            </span>{" "}
            shown
          </span>
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            Add category
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            label="Categories"
            rows={categories}
            columns={columns}
            rowKey={(c) => c.id}
            loading={isLoading}
            density="comfortable"
            minWidth={520}
            rowActions={(c) => [
              {
                label: c.isActive ? "Hide from the public" : "Show publicly",
                onSelect: () => void toggle(c, !c.isActive),
              },
              { type: "separator" as const },
              { label: "Delete", icon: Trash2, destructive: true, onSelect: () => setDeleting(c) },
            ]}
            rowActionsLabel={(c) => `Actions for ${c.name}`}
            empty={
              <EmptyState
                inline
                icon={Tags}
                title="No categories yet"
                description="Add the first one, or run the seed."
              />
            }
            mobileRow={(c) => (
              <div className="ra-card flex items-center gap-3 p-3.5">
                <span className="ra-service-icon h-9 w-9">
                  <CategoryIcon name={c.icon ?? c.name} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {c.name}
                    {!c.isActive && <Badge tone="warning">Hidden</Badge>}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">/{c.slug}</p>
                </div>
                <Switch
                  checked={c.isActive}
                  onChange={(v) => void toggle(c, v)}
                  label={`Show ${c.name} publicly`}
                />
                <RowMenu
                  items={[
                    {
                      label: "Delete",
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => setDeleting(c),
                    },
                  ]}
                  label={`Actions for ${c.name}`}
                  size="md"
                  variant="secondary"
                />
              </div>
            )}
          />
        </div>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" aria-hidden="true" />
              What businesses are typing
            </span>
          }
          description="Services entered under “mention your service” because nothing in the list covered them. A term appearing often is an argument for a new category."
          className="h-fit"
        >
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="space-y-2">
              {suggestions.slice(0, 12).map((s) => (
                <li key={s.service}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-foreground">{s.service}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add category" size="sm">
        {form}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "category"}?`}
        description="Refused if any business is listed under it — hide it instead, or reassign them first."
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={() => deleting && destroy(deleting)}
      />
    </div>
  );
}
