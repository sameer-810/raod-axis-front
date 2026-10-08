import { Link } from "react-router-dom";

/**
 * The line that sits under every button that hands us somebody's details.
 *
 * It says what pressing the button means, at the moment of pressing it — which
 * is the only place a notice like this is ever read. A checkbox was considered
 * and left out: the lawful basis for a sign-in or a booking request is that the
 * person asked for it, not consent, and a tick-box nobody can decline is theatre
 * that also costs a tap on a phone at the roadside.
 *
 * The links open in a new tab so that reading the policy does not throw away a
 * half-filled form.
 */
export function LegalNote({
  action,
  className = "",
}: {
  /** What the button above says, lower-case: "sending this request". */
  action: string;
  className?: string;
}) {
  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className}`} data-legal-note>
      By {action} you agree to our{" "}
      <Link
        to="/terms"
        target="_blank"
        rel="noopener"
        className="font-medium text-foreground underline underline-offset-2 hover:text-primary-text"
      >
        Terms
      </Link>{" "}
      and confirm you have read the{" "}
      <Link
        to="/privacy"
        target="_blank"
        rel="noopener"
        className="font-medium text-foreground underline underline-offset-2 hover:text-primary-text"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
