/**
 * Google's sign-in, in the browser — FR-AUT-07, DECISIONS.md D-039.
 *
 * Uses the Google Identity Services *token client*: our own button opens
 * Google's account chooser in a popup and hands back an access token, which
 * the server checks with Google before believing it. Google's own rendered
 * button was the alternative; it is an iframe we cannot size, label or test,
 * and it sat under the 44 px touch floor every other control on the page meets.
 *
 * The script is loaded only when somebody presses the button, so a visitor who
 * signs in by email — or never signs in — downloads nothing from Google.
 */

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: { type?: string; message?: string }) => void;
    }): TokenClient;
  };
}

declare global {
  interface Window {
    google?: { accounts?: GoogleAccounts };
  }
}

/** The person closed Google's window or chose not to continue. Not an error to show. */
export class GoogleCancelled extends Error {}

let loading: Promise<GoogleAccounts> | null = null;

function loadScript(): Promise<GoogleAccounts> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts);
  if (loading) return loading;
  loading = new Promise<GoogleAccounts>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.oauth2
        ? resolve(window.google.accounts)
        : reject(new Error("Google sign-in did not load."));
    script.onerror = () => reject(new Error("Google sign-in did not load."));
    document.head.appendChild(script);
  }).catch((err) => {
    // A failed load (offline, blocked) must be retryable on the next press.
    loading = null;
    throw err;
  });
  return loading;
}

/**
 * Ask Google who this is. Resolves with an access token that may read the
 * person's name and email address — nothing else is requested.
 */
export async function requestGoogleToken(clientId: string): Promise<string> {
  const accounts = await loadScript();
  return new Promise<string>((resolve, reject) => {
    const client = accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else if (response.error === "access_denied") reject(new GoogleCancelled());
        else reject(new Error(response.error_description || "Google sign-in didn't work."));
      },
      error_callback: (error) =>
        error?.type === "popup_closed"
          ? reject(new GoogleCancelled())
          : reject(new Error(error?.message || "Google sign-in didn't work.")),
    });
    // Always offer the choice of account: on a shared or family phone the
    // account Google remembers is often not the driver's.
    client.requestAccessToken({ prompt: "select_account" });
  });
}
