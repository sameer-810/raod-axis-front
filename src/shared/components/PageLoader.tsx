/**
 * Route-level loading state.
 *
 * `role="status"` with a live region so a screen-reader user is told the page
 * is loading, rather than landing on silence. The visible spinner is hidden
 * from them because "loading" is already announced.
 */
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div
        className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
