import {
  LayoutDashboard,
  Store,
  ClipboardCheck,
  MessageSquare,
  Tags,
  ScrollText,
  CalendarClock,
  BarChart3,
  Star,
  Upload,
} from "lucide-react";
import type { Role } from "@/modules/auth/authSlice";

export type MenuItem = {
  label: string;
  /**
   * Label for the mobile tab bar, where a tab gets a fifth of a 390px screen.
   * "Booking Requests" renders as "Booking…", which is worse than a shorter
   * true name.
   */
  shortLabel?: string;
  to?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Roles allowed to see this item. Omit = every authenticated role. */
  roles?: Role[];
  /** A "go to" sequence: "g b" jumps to Businesses. Two keys, no modifier. */
  shortcut?: string;
  /** Words the palette also matches — "inbox" finds Booking Requests. */
  keywords?: string[];
};

export type MenuSection = {
  heading?: string;
  items: MenuItem[];
};

/**
 * The authenticated navigation, shared by the Business Portal and the Admin
 * Console. One menu filtered by role rather than two, so a route cannot be
 * added to one and forgotten in the other. Empty sections are dropped.
 */
const SECTIONS: MenuSection[] = [
  {
    items: [
      {
        label: "Overview",
        to: "/portal",
        icon: LayoutDashboard,
        shortcut: "g o",
        keywords: ["home", "dashboard"],
      },
    ],
  },
  {
    heading: "My business",
    items: [
      {
        label: "My Listing",
        shortLabel: "Listing",
        to: "/portal/listing",
        icon: Store,
        roles: ["business_owner"],
        shortcut: "g l",
        keywords: ["edit", "photos", "hours", "services"],
      },
      {
        label: "Booking Requests",
        shortLabel: "Requests",
        to: "/portal/requests",
        icon: CalendarClock,
        roles: ["business_owner"],
        shortcut: "g r",
        keywords: ["inbox", "bookings", "customers"],
      },
      {
        label: "WhatsApp Numbers",
        shortLabel: "WhatsApp",
        to: "/portal/whatsapp",
        icon: MessageSquare,
        roles: ["business_owner"],
        shortcut: "g w",
        keywords: ["phone", "routing"],
      },
      {
        label: "Performance",
        to: "/portal/performance",
        icon: BarChart3,
        roles: ["business_owner"],
        shortcut: "g p",
        keywords: ["analytics", "views", "stats"],
      },
    ],
  },
  {
    heading: "Directory",
    items: [
      {
        label: "Businesses",
        to: "/admin/businesses",
        icon: Store,
        roles: ["admin"],
        shortcut: "g b",
        keywords: ["listings", "garages"],
      },
      {
        label: "Claims",
        to: "/admin/claims",
        icon: ClipboardCheck,
        roles: ["admin"],
        shortcut: "g c",
        keywords: ["queue", "ownership", "review"],
      },
      {
        label: "Categories",
        to: "/admin/categories",
        icon: Tags,
        roles: ["admin"],
        shortcut: "g t",
        keywords: ["taxonomy", "services"],
      },
      {
        label: "Reviews",
        to: "/admin/reviews",
        icon: Star,
        roles: ["admin"],
        shortcut: "g v",
        keywords: ["ratings", "moderation"],
      },
      {
        label: "Import listings",
        shortLabel: "Import",
        to: "/admin/businesses/import",
        icon: Upload,
        roles: ["admin"],
        shortcut: "g i",
        keywords: ["csv", "spreadsheet", "bulk"],
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      {
        label: "Analytics",
        to: "/admin/analytics",
        icon: BarChart3,
        roles: ["admin"],
        shortcut: "g a",
        keywords: ["dashboard", "kpi", "stats"],
      },
      {
        label: "WhatsApp Logs",
        shortLabel: "Logs",
        to: "/admin/whatsapp-logs",
        icon: MessageSquare,
        roles: ["admin"],
        shortcut: "g d",
        keywords: ["delivery", "messages", "failed"],
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        label: "Audit Log",
        shortLabel: "Audit",
        to: "/admin/audit",
        icon: ScrollText,
        roles: ["admin"],
        shortcut: "g u",
        keywords: ["history", "who did what"],
      },
    ],
  },
];

/** Keep items whose roles include the current role, or that name no roles. */
export function filterMenu(items: MenuItem[], role: Role | undefined): MenuItem[] {
  return items.filter((item) => !item.roles || (role ? item.roles.includes(role) : false));
}

/** Filter sections by role and drop any that end up empty. */
export function filterSections(role: Role | undefined): MenuSection[] {
  return SECTIONS.map((s) => ({ heading: s.heading, items: filterMenu(s.items, role) })).filter(
    (s) => s.items.length > 0,
  );
}

/** Flat list across sections — used by the command palette and the breadcrumb. */
export const MENU: MenuItem[] = SECTIONS.flatMap((s) => s.items);
export { SECTIONS };

/** The section a path belongs to, for the breadcrumb. Longest prefix wins, so
 *  /admin/businesses/import reads "Import listings", not "Businesses". */
export function sectionOf(pathname: string): { heading?: string; item?: MenuItem } {
  let best: { heading?: string; item?: MenuItem; length: number } = { length: -1 };
  for (const s of SECTIONS) {
    for (const item of s.items) {
      if (!item.to) continue;
      const match = item.to === "/portal" ? pathname === "/portal" : pathname.startsWith(item.to);
      if (match && item.to.length > best.length)
        best = { heading: s.heading, item, length: item.to.length };
    }
  }
  return { heading: best.heading, item: best.item };
}

/**
 * Destination priority for the mobile tab bar, most-used first. A ranking
 * rather than a menu: the first four a role can see become tabs and the rest
 * stay in the sheet.
 */
const MOBILE_TAB_ORDER = [
  "/portal",
  "/portal/requests",
  "/portal/listing",
  "/admin/claims",
  "/admin/businesses",
  "/portal/whatsapp",
  "/admin/whatsapp-logs",
  "/admin/categories",
  "/admin/audit",
];

/** The four tabs for a role, in bar order, from the same role-filtered menu the sidebar uses. */
export function mobileTabs(role: Role | undefined): MenuItem[] {
  const allowed = new Map(
    filterMenu(
      SECTIONS.flatMap((s) => s.items),
      role,
    )
      .filter((i) => i.to)
      .map((i) => [i.to as string, i]),
  );
  return MOBILE_TAB_ORDER.map((p) => allowed.get(p))
    .filter((i): i is MenuItem => Boolean(i))
    .slice(0, 4);
}
