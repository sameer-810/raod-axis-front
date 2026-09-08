import { toast as sonner } from "sonner";

/**
 * One wrapper, so the whole product swaps notification library in one file and
 * so nobody reaches for a variant the design does not have.
 */
export const toast = {
  success: (message: string) => sonner.success(message),
  error: (message: string) => sonner.error(message),
  info: (message: string) => sonner.message(message),
};
