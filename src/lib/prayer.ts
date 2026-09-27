import { DAY, localDate } from "./dates";
import { get, set } from "./storage";
import type { Location, PrayerCache, PrayerDay, Settings } from "./types";

const API = "https://api.aladhan.com/v1";
/** How many past days of prayer times to keep in the cache. */
const KEEP_DAYS = 7;

interface AladhanDay {
  timings: { Fajr: string; Maghrib: string };
  date: { gregorian: { date: string } }; // DD-MM-YYYY
}

function cacheKey(location: Location, method: number): string {
  return JSON.stringify({ location, method });
}

function monthUrl(location: Location, method: number, year: number, month: number): string {
  const params = new URLSearchParams({ method: String(method), iso8601: "true" });
  if (location.kind === "coords") {
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
    return `${API}/calendar/${year}/${month}?${params}`;
  }
  params.set("city", location.city);
  params.set("country", location.country);
  return `${API}/calendarByCity/${year}/${month}?${params}`;
}

async function fetchMonth(
  location: Location,
  method: number,
  year: number,
  month: number,
): Promise<Record<string, PrayerDay>> {
  const res = await fetch(monthUrl(location, method, year, month));
  if (!res.ok) throw new Error(`Aladhan API returned HTTP ${res.status}`);
  const body = (await res.json()) as { code: number; data: AladhanDay[] | string };
  if (body.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(`Aladhan API error: ${typeof body.data === "string" ? body.data : body.code}`);
  }

  const days: Record<string, PrayerDay> = {};
  for (const entry of body.data) {
    const [d, m, y] = entry.date.gregorian.date.split("-");
    const fajr = Date.parse(entry.timings.Fajr);
    const maghrib = Date.parse(entry.timings.Maghrib);
    if (Number.isNaN(fajr) || Number.isNaN(maghrib)) throw new Error("Unexpected prayer time format");
    days[`${y}-${m}-${d}`] = { fajr, maghrib };
  }
  return days;
}

/**
 * Return cached prayer days covering yesterday..tomorrow, fetching missing months.
 * The cache is dropped whenever the location or calculation method changes.
 */
export async function ensurePrayerDays(
  settings: Settings,
  now: number,
): Promise<Record<string, PrayerDay>> {
  if (!settings.location) throw new Error("Location is not set");
  const key = cacheKey(settings.location, settings.method);

  const stored = await get("prayerCache");
  const cache: PrayerCache = stored?.key === key ? stored : { key, days: {} };

  const needed = [-1, 0, 1, 2].map((n) => localDate(now + n * DAY));
  const missingMonths = new Set(needed.filter((d) => !cache.days[d]).map((d) => d.slice(0, 7)));
  if (missingMonths.size === 0) return cache.days;

  for (const ym of missingMonths) {
    const [y, m] = ym.split("-").map(Number) as [number, number];
    Object.assign(cache.days, await fetchMonth(settings.location, settings.method, y, m));
  }

  const oldest = localDate(now - KEEP_DAYS * DAY);
  for (const date of Object.keys(cache.days)) {
    if (date < oldest) delete cache.days[date];
  }
  await set("prayerCache", cache);
  return cache.days;
}
