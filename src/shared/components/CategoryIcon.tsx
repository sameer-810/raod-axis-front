import {
  CircleDot,
  BatteryCharging,
  Droplet,
  Disc,
  Wrench,
  TowerControl,
  Sparkles,
  Crosshair,
  Wind,
  Cog,
  Truck,
  Car,
} from "lucide-react";

/**
 * Category name → icon. An explicit map rather than a dynamic lookup into the
 * whole of lucide, for two reasons:
 *
 *  1. Tree-shaking. `import * as icons` pulls the entire library — about 1.5 MB of
 *     SVG — into the first chunk a driver downloads on 4G.
 *  2. Categories are **data** (D-013): an administrator can create one tomorrow
 *     with any icon name they like, including a typo. A map with a fallback
 *     degrades to a car; a dynamic lookup renders `undefined` and throws.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CircleDot,
  BatteryCharging,
  Droplet,
  Disc,
  Wrench,
  TowerControl,
  Sparkles,
  Crosshair,
  Wind,
  Cog,
  Truck,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Car;
  return <Icon className={className} />;
}

export { ICONS };
