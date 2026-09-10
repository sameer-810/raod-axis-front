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
};

export type MenuSection = {
  heading?: string;
  items: MenuItem[];
};

/**
 * The authenticated navigation, shared by the Business Portal and the Admin
 * Console.
 *
 * One menu filtered by role rather than two. Two menus drift: a route gets added
 * to one and not the other. Empty sections are dropped, so an owner never sees
 * an "Administration" heading with nothing under it.
 */
/**
 * Only destinations that exist. Items are added with the phase that builds them,
 * exactly as routes are in App.tsx — a menu advertising screens that 404 teaches
 * people the navigation is unreliable, and they stop reading it.
 */
const SECTIONS: MenuSection[] = [
  {
    items: [{ label: "Overview", to: "/portal", icon: LayoutDashboard }],
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
      },
      {
        label: "Booking Requests",
        shortLabel: "Requests",
        to: "/portal/requests",
        icon: CalendarClock,
        roles: ["business_owner"],
      },
      {
        label: "WhatsApp Numbers",
        shortLabel: "WhatsApp",
        to: "/portal/whatsapp",
        icon: MessageSquare,
        roles: ["business_owner"],
      },
      {
        label: "Performance",
        to: "/portal/performance",
        icon: BarChart3,
        roles: ["business_owner"],
      },
    ],
  },
  {
    heading: "Directory",
    items: [
      { label: "Businesses", to: "/admin/businesses", icon: Store, roles: ["admin"] },
      { label: "Claims", to: "/admin/claims", icon: ClipboardCheck, roles: ["admin"] },
      { label: "Categories", to: "/admin/categories", icon: Tags, roles: ["admin"] },
      { label: "Reviews", to: "/admin/reviews", icon: Star, roles: ["admin"] },
      {
        label: "Import listings",
        shortLabel: "Import",
        to: "/admin/businesses/import",
        icon: Upload,
        roles: ["admin"],
      },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3, roles: ["admin"] },
      {
        label: "WhatsApp Logs",
        shortLabel: "Logs",
        to: "/admin/whatsapp-logs",
        icon: MessageSquare,
        roles: ["admin"],
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

/** Flat list across sections — used by the command palette. */
export const MENU: MenuItem[] = SECTIONS.flatMap((s) => s.items);
export { SECTIONS };

/**
 * Destination priority for the mobile tab bar, most-used first.
 *
 * A ranking rather than a menu: the first four a role can see become tabs and
 * the rest stay in the sheet. Ordered by daily reach, not by the sidebar's
 * subject grouping — an owner opens Booking Requests every day and Settings
 * twice a year, and the admin's Claims sits high because in the first months
 * clearing that queue is most of the job.
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

/**
 * The four tabs for a role, in bar order. Resolved against the same
 * role-filtered menu the sidebar uses, so a permission can never be granted here
 * that the sidebar would deny.
 */
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
