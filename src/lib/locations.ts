import citiesData from "../data/cities.json";
import countriesData from "../data/countries.json";
import timezonesData from "../data/timezones.json";
import type { Location } from "./types";

/** One offline city (GeoNames, CC BY 4.0). See scripts/build_locations.py. */
export interface City {
  name: string;
  arabic: string;
  countryCode: string;
  country: string;
  latitude: number;
  longitude: number;
  /** Other names to match, joined by "|" (ASCII spelling, English alternates such as "Mecca"). */
  aliases: string;
}

type CityRow = [name: string, arabic: string, cc: string, lat: number, lng: number, aliases: string];
type ZoneRow = [city: string, cc: string, country: string, lat: number, lng: number];

const countries = countriesData as Record<string, string>;
const timezones = timezonesData as unknown as Record<string, ZoneRow>;

let cities: City[] | undefined;

/** All offline cities, most populous first. Parsed on first use. */
export function allCities(): City[] {
  cities ??= (citiesData as unknown as CityRow[]).map(([name, arabic, cc, latitude, longitude, aliases]) => ({
    name,
    arabic,
    countryCode: cc,
    country: countries[cc] ?? cc,
    latitude,
    longitude,
    aliases,
  }));
  return cities;
}

export function cityLocation(city: City): Location {
  return { latitude: city.latitude, longitude: city.longitude, name: `${city.name}, ${city.country}` };
}

/**
 * Guess a location from an IANA time zone (e.g. "Africa/Cairo"), fully offline: the tz
 * database records the coordinates of each zone's principal city.
 */
export function locationFromTimeZone(timeZone: string | undefined): (Location & { name: string }) | undefined {
  const zone = timeZone ? timezones[timeZone] : undefined;
  if (!zone) return undefined;
  const [city, , country, latitude, longitude] = zone;
  return { latitude, longitude, name: `${city}, ${country}` };
}

export function systemTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Case-, accent- and tashkeel-insensitive form for matching names. */
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "").toLowerCase().trim();

export function cityNames(city: City): string[] {
  return [city.name, city.arabic, ...city.aliases.split("|")].filter(Boolean);
}

/**
 * Resolve a free-text city/country (the pre-offline settings format) against the offline list.
 * Matches the city on its name, Arabic name or aliases, and the country on its name or code.
 */
export function findCity(city: string, country: string): City | undefined {
  const c = fold(city);
  const k = fold(country);
  if (!c) return undefined;
  const nameMatches = (x: City) => cityNames(x).some((n) => fold(n) === c);
  const countryMatches = (x: City) => !k || fold(x.country) === k || fold(x.countryCode) === k;
  return allCities().find((x) => nameMatches(x) && countryMatches(x));
}
