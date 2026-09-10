import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/shared/components/Logo";

/**
 * The frame every sign-in screen sits in: a dark brand panel saying why you are
 * signing in, and the form beside it. A centred form alone in a column of white
 * space is what every generated template produces, and read as one.
 *
 * The photograph is decoration — the ink carries the contrast if it never loads.
 * Below `lg` the panel collapses to a short dark strip, so a phone gets the form
 * in the first screenful.
 */
const HERO =
  "https://images.unsplash.com/photo-1615906655593-ad0386982a0f?ixlib=rb-4.1.0&q=60&fm=jpg&crop=entropy&cs=srgb&w=1400";

export function AuthShell({
  eyebrow,
  headline,
  points,
  backTo = "/",
  backLabel = "Back to RoadAxis",
  children,
}: {
  /** Small mono label above the headline: who this door is for. */
  eyebrow: string;
  headline: React.ReactNode;
  /** Three at most. Reasons, not features. */
  points: string[];
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <aside className="ra-auth-panel">
        <img src={HERO} alt="" aria-hidden="true" className="ra-auth-panel-image" />
        <div className="relative flex h-full flex-col justify-between p-6 lg:p-10">
          <Link
            to={backTo}
            className="ra-tap inline-flex w-fit items-center gap-2 rounded-lg text-sm text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>

          <div className="mt-8 lg:mt-0">
            <p className="ra-eyebrow text-primary">{eyebrow}</p>
            <h2 className="mt-3 max-w-md font-display text-3xl font-bold leading-[1.05] tracking-tight text-white lg:text-[2.6rem]">
              {headline}
            </h2>
            <ul className="mt-6 hidden space-y-2.5 lg:block">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] text-white/80">
                  <span
                    aria-hidden="true"
                    className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 hidden items-center gap-2 lg:flex">
            <Logo onDark showWordmark className="text-white" />
          </div>
        </div>
      </aside>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <main className="flex items-start justify-center px-4 py-8 sm:px-6 lg:items-center lg:px-12 lg:py-12">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  );
}
