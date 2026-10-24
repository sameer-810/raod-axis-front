import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, MapPin } from "lucide-react";
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
        // A place, as the reference shows it: a red pin, the country, a
        // chevron that says it opens. The accessible name keeps "Country:" so
        // a screen reader hears what kind of thing it is.
        <button
          type="button"
          {...props}
          aria-label={`Country: ${market.name}`}
          className="ra-tap flex min-w-[44px] items-center justify-center gap-1 rounded-full px-2.5 text-[15px] font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <MapPin className="h-[18px] w-[18px] text-primary-text" aria-hidden="true" />
          <span>{short(market.shortName)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      )}
    />
  );
}
