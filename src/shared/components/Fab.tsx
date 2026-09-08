import { Plus } from "lucide-react";

/**
 * The screen's one primary create action, on mobile only.
 *
 * On desktop this action lives in the page header, which on a phone is both
 * off-thumb and competing with the title and any secondary controls for a
 * 390px row. Exactly one per screen: a second FAB means the screen has no
 * single primary action and the pattern is the wrong one for it.
 */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="ra-fab md:hidden"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
