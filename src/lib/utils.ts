import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class names with Tailwind conflict resolution.
 * `cn("p-2", condition && "p-4")` yields "p-4", not both.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
