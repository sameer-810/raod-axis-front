/** A named place to search around, in a country with no postcodes to look up. */
export interface MarketPlace {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

/**
 * A country RoadAxis operates in, as the server describes it. Everything that
 * differs between countries is here, so no screen needs to know which country
 * it is in — only what that country's rules are.
 */
export interface Market {
  /** ISO 3166-1 alpha-2: "GB", "AE". */
  code: string;
  name: string;
  /** As it reads in a sentence: "the UK", "the UAE". */
  shortName: string;
  dialCode: string;
  currency: string;
  timezone: string;
  locale: string;
  phoneExample: string;
  address: {
    postcode: "required" | "none";
    postcodeLabel: string | null;
    region: "required" | "none";
    regionLabel: string | null;
    cityLabel: string;
  };
  regions: string[];
  places: MarketPlace[];
  centre: { latitude: number; longitude: number };
  bounds: { south: number; west: number; north: number; east: number };
  privacy: {
    law: string;
    lawShort: string;
    regulator: string;
    regulatorUrl: string | null;
  };
}

export interface MarketList {
  default: string;
  /** Open to the public. */
  markets: Market[];
  /** Every country this server serves, open or paused (D-043). */
  all?: Array<Market & { live: boolean }>;
}
