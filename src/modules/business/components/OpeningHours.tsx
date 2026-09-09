import { cn } from "@/lib/utils";
import type { WorkingHoursDay } from "../types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The week, with today marked.
 *
 * Rendered Monday-first because that is how a UK reader expects a week, while
 * the data is Sunday-indexed to match JavaScript's own `getDay()` — converting
 * once here is cheaper than a translation layer in every query.
 *
 * Today's row is picked out because "is it open now" is the question, and
 * making someone count rows to find Thursday is work the interface should do.
 */
export function OpeningHours({
  hours,
  timezone = "Europe/London",
}: {
  hours: WorkingHoursDay[];
  timezone?: string;
}) {
  // The business's own day, not the reader's. Someone checking a Manchester
  // garage from abroad should see Manchester's Thursday highlighted.
  const today = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "weekday")
      ? new Date(new Date().toLocaleString("en-US", { timeZone: timezone })).getDay()
      : new Date().getDay(),
  );

  const byDay = new Map(hours.map((h) => [h.day, h]));
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Opening hours</caption>
      <tbody>
        {order.map((day) => {
          const entry = byDay.get(day);
          const isToday = day === today;
          return (
            <tr key={day} className={cn(isToday && "font-medium text-foreground")}>
              <th
                scope="row"
                className={cn(
                  "py-1.5 pe-4 text-start font-normal",
                  isToday ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {DAY_NAMES[day]}
                {isToday && <span className="sr-only"> (today)</span>}
              </th>
              <td
                className={cn(
                  "py-1.5 text-end font-mono tabular-nums",
                  !entry || entry.closed ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {!entry || entry.closed ? "Closed" : `${entry.open}–${entry.close}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
