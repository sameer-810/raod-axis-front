import { useState } from "react";
import { Plus, Trash2, Lightbulb } from "lucide-react";
import { toast } from "@/shared/lib/toast";
import { getApiErrorMessage } from "@/shared/api/http";
import { Badge } from "@/shared/components/Badge";
import { Field } from "@/shared/components/Field";
import { Sheet } from "@/shared/components/Sheet";
import { useIsMobile } from "@/shared/hooks/useMediaQuery";
import {
  useAdminCategories,
  useCategorySuggestions,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../hooks/useAdmin";

/**
 * Category management — FR-ADM-05.
 *
 * Two halves, and the second is the interesting one: the managed taxonomy on the
 * left, and on the right what businesses have typed into "mention your service"
 * because it did not cover them. A term appearing eleven times is an argument
 * for a category; one appearing once is not.
 */
export function AdminCategoriesPage() {
  const isMobile = useIsMobile();
  const { data: categories = [], isLoading } = useAdminCategories();
  const { data: suggestions = [] } = useCategorySuggestions();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  async function toggle(id: string, isActive: boolean) {
    try {
      await update.mutateAsync({ id, payload: { isActive } });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function destroy(id: string, label: string) {
    try {
      await remove.mutateAsync(id);
      toast.success(`${label} deleted`);
    } catch (err) {
      // The server refuses when businesses are using it and names the count, so
      // an administrator knows to reassign them or switch it off instead.
      toast.error(getApiErrorMessage(err));
    }
  }

  const form = (
    <form onSubmit={add} className="space-y-1">
      <Field
        label="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Windscreens"
        hint="The URL is generated from the name and stays fixed if you rename it later."
        error={error ?? undefined}
      />
      <button
        type="submit"
        disabled={create.isPending}
        className="ra-tap w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
      >
        {create.isPending ? "Adding…" : "Add category"}
      </button>
    </form>
  );

  return (
    <div className="ra-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hidden text-xl font-semibold tracking-tight text-foreground md:block">
            Categories
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{categories.length}</span> categories · changes
            reach the public filter immediately
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ra-tap flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="ra-panel px-4 py-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <ul className="ra-panel divide-y divide-border">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.name}
                      {!c.isActive && (
                        <Badge className="ms-2" tone="warning">
                          Hidden
                        </Badge>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">/{c.slug}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="ra-tap flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={c.isActive}
                        onChange={(e) => toggle(c.id, e.target.checked)}
                        className="rounded border-input accent-primary"
                      />
                      <span className="hidden sm:inline">Shown</span>
                      <span className="sr-only sm:hidden">Show {c.name} publicly</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => destroy(c.id, c.name)}
                      aria-label={`Delete ${c.name}`}
                      title="Delete"
                      className="ra-tap flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section aria-labelledby="suggestions" className="ra-tile h-fit">
          <h2
            id="suggestions"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Lightbulb className="h-4 w-4 text-warning" aria-hidden="true" />
            What businesses are typing
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Services entered under “mention your service” because nothing in the list covered them.
            A term appearing often is an argument for a new category.
          </p>
          {suggestions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {suggestions.slice(0, 15).map((s) => (
                <li key={s.service} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{s.service}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen} title="Add category">
          {form}
        </Sheet>
      ) : (
        open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="ra-overlay w-full max-w-sm p-6">
              <h2 className="mb-4 text-base font-semibold text-foreground">Add category</h2>
              {form}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ra-tap mt-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
