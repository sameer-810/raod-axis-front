import { useLocation, useNavigate } from "react-router-dom";
import { Check, Globe } from "lucide-react";
import { useMarket } from "@/app/market";
import { Menu } from "@/shared/components/Menu";

/**
 * Which country's directory the visitor is looking at, and the way to change it.
 *
 * In the header on every public page, because it changes what every public
 * page shows: which garages are searched, what a phone number looks like, what
 * an address consists of. Absent entirely on a deployment that serves one
 * country — a switch with one position is not a control.
 *
 * Changing country on the search page drops the position being searched
 * around, and only that. "Within 5 km of Deansgate" is not a search of Dubai;
 * "tyres" is a perfectly good one.
 */
export function CountrySwitch() {
  const { market, markets, hasChoice, setMarket } = useMarket();
  const navigate = useNavigate();
  const location = useLocation();

  if (!hasChoice) return null;

  /** "the UK" → "UK". Short enough to sit in a phone's header. */
  const short = (name: string) => name.replace(/^the /, "");

  function choose(code: string) {
    if (code === market.code) return;
    setMarket(code);
    if (location.pathname === "/search") {
      const params = new URLSearchParams(location.search);
      for (const key of ["lat", "lng", "radius", "city", "page", "country"]) params.delete(key);
      const query = params.toString();
      navigate({ pathname: "/search", search: query ? `?${query}` : "" }, { replace: true });
    }
  }

  return (
    <Menu
      label="Country"
      items={markets.map((m) => ({
        label: m.name,
        icon: m.code === market.code ? Check : undefined,
        onSelect: () => choose(m.code),
      }))}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Country: ${market.name}`}
          className="ra-tap flex min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span>{short(market.shortName)}</span>
        </button>
      )}
    />
  );
}
