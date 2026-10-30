/**
 * The times and dates on the booking form. The server holds the same slot list
 * (`booking-request.constants.js`) and has the last word on it.
 */
const pad = (hour: number) => String(hour).padStart(2, "0");

function hourWords(hour: number) {
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

/** 8 AM to 10 PM, an hour at a time. */
export const DAY_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const hour = 8 + i;
  return {
    value: `${pad(hour)}:00-${pad(hour + 1)}:00`,
    label: `${hourWords(hour)} - ${hourWords(hour + 1)}`,
    /** The hour it ends, to tell when it has passed. */
    endHour: hour + 1,
  };
});

/** The whole night is one slot: nobody asks a garage for 3 AM to 4 AM. */
export const NIGHT_SLOT = "22:00-08:00";

/** Today where the garage is, as YYYY-MM-DD. */
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The current hour where the garage is, 0 to 23. */
export function hourIn(timeZone: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
}

// Dates here are calendar days, not moments, so they are worked out in UTC: a
// clock change or the reader's own zone can never move one to a different day.
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number) {
  return new Date(utc(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** A date split up for a tile: "Wed", "29", "Oct", and in full for a screen reader. */
export function dayParts(iso: string) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(utc(iso));
  return {
    weekday: part({ weekday: "short" }),
    longWeekday: part({ weekday: "long" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    full: part({ weekday: "long", day: "numeric", month: "long" }),
    /** Sunday is 0, as in a garage's working hours. */
    dayOfWeek: utc(iso).getUTCDay(),
  };
}
