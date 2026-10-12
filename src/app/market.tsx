import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/modules/market/api/marketApi";
import type { Market, MarketList } from "@/modules/market/types";
import { marketStore } from "@/shared/lib/marketStore";

/**
 * Which country the visitor is browsing — the UK or the UAE — and what that
 * country's rules are.
 *
 * The list of countries comes from the server, because the server is what
 * decides which are switched on and it is the one that enforces their rules.
 * Until it has answered, the page runs on the copy remembered from the last
 * visit, or failing that on the first market's facts, so nothing waits on a
 * request to draw a search box.
 *
 * How the country is settled, in order: one named in the address
 * (`?country=AE`, so a shared link opens where it was shared from), one the
 * visitor chose before, a guess from the device's clock, and last the server's
 * default. A choice and a shared link are remembered; a guess is not — see
 * `marketStore`.
 */

/** The first market, as a stand-in until the server has been heard from. */
const FIRST_MARKET: Market = {
  code: "GB",
  name: "United Kingdom",
  shortName: "the UK",
  dialCode: "+44",
  currency: "GBP",
  timezone: "Europe/London",
  locale: "en-GB",
  phoneExample: "07700 900123",
  address: {
    postcode: "required",
    postcodeLabel: "Postcode",
    region: "none",
    regionLabel: null,
    cityLabel: "Town or city",
  },
  regions: [],
  places: [],
  centre: { latitude: 53.4808, longitude: -2.2426 },
  bounds: { south: 49.8, west: -8.7, north: 60.9, east: 1.8 },
  privacy: {
    law: "the UK General Data Protection Regulation and the Data Protection Act 2018",
    lawShort: "UK GDPR",
    regulator: "the Information Commissioner's Office (ICO)",
    regulatorUrl: "https://ico.org.uk",
  },
};

const CACHE_KEY = "roadaxis_markets";

function readCache(): MarketList | undefined {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null");
    if (Array.isArray(parsed?.markets) && parsed.markets.length && parsed.markets[0].bounds) {
      return parsed as MarketList;
    }
  } catch {
    // Unreadable or absent; the request below fills it.
  }
  return undefined;
}

interface MarketContextValue {
  /** The country being browsed. */
  market: Market;
  /** Every country that is switched on. */
  markets: Market[];
  /** The server's own default country, once it has said. */
  defaultCode: string | null;
  /** False until the server's list — or a remembered copy of it — is in hand. */
  ready: boolean;
  /** True when there is a choice to offer. */
  hasChoice: boolean;
  /** Choose a country. Remembered across visits. */
  setMarket: (code: string) => void;
  /** The rules of a named country — a listing's own — or of the one being browsed. */
  marketFor: (code: string | null | undefined) => Market;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const list = await marketApi.list();
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      } catch {
        // Private browsing. The list is simply asked for again next time.
      }
      return list;
    },
    initialData: readCache,
    // The remembered copy is for the first paint only; always check it.
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60 * 1000,
  });

  const markets = useMemo(() => (data?.markets?.length ? data.markets : [FIRST_MARKET]), [data]);
  const stored = useSyncExternalStore(marketStore.subscribe, marketStore.get, () => null);

  const market = useMemo(() => {
    const byCode = (code: string | null | undefined) =>
      markets.find((m) => m.code === String(code ?? "").toUpperCase());

    const chosen = byCode(stored);
    if (chosen) return chosen;

    // Nothing chosen yet. A device on Dubai time is, far more often than not,
    // a person in the UAE; anywhere the clock does not settle it, the default.
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // No Intl time zone; the default stands.
    }
    return markets.find((m) => m.timezone === zone) ?? byCode(data?.default) ?? markets[0];
  }, [markets, stored, data?.default]);

  /**
   * A country named in the address wins, once, on arrival — a link shared from
   * the UAE side opens on the UAE side. Read from `window.location` so this
   * provider can sit above the router.
   */
  const keptAddress = useRef(false);
  useEffect(() => {
    if (!data || keptAddress.current) return;
    keptAddress.current = true;
    const named = marketStore.fromAddress();
    if (named && data.markets.some((m) => m.code === named)) {
      marketStore.set(named, { remember: true });
    }
  }, [data]);

  /**
   * Whatever was settled on — chosen or guessed — is what requests are sent as.
   * Not before the list is in hand: until then the only market known is the
   * stand-in, and writing it here would overwrite a country the address named.
   */
  useEffect(() => {
    if (!data) return;
    if (marketStore.get() !== market.code) marketStore.set(market.code, { remember: false });
  }, [data, market.code]);

  const setMarket = useCallback((code: string) => marketStore.set(code, { remember: true }), []);

  const marketFor = useCallback(
    (code: string | null | undefined) =>
      markets.find((m) => m.code === String(code ?? "").toUpperCase()) ?? market,
    [markets, market],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      market,
      markets,
      defaultCode: data?.default ?? null,
      ready: Boolean(data),
      hasChoice: markets.length > 1,
      setMarket,
      marketFor,
    }),
    [market, markets, data, setMarket, marketFor],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within <MarketProvider>");
  return ctx;
}
