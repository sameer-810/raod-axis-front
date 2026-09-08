import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * The last line of defence. A render error anywhere below this becomes a page
 * that says so, rather than a white screen — which on the public side is
 * indistinguishable from the site being down.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Deliberately console rather than a service: there is no error reporter
    // wired up yet, and swallowing it silently would be worse than noisy.
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="ra-panel max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page couldn't be displayed. Reloading usually fixes it.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="ra-tap mt-5 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
