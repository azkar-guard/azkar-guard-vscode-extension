#!/usr/bin/env python3
"""Generate the offline location data used to set a location without any API.

src/data/cities.json
    Cities from GeoNames (https://www.geonames.org, CC BY 4.0): every city with
    population >= 100,000 plus every capital. Compact rows:
    [name, arabic_name_or_empty, country_code, latitude, longitude, extra_names_joined_by_|].
    Arabic and English alternate names come from GeoNames' language-tagged
    alternateNamesV2 (isolanguage "ar" / "en"), preferring names flagged as preferred
    and skipping historic and colloquial ones. The English names and the ASCII name
    are kept as extra search terms (e.g. "Mecca" for Makkah).

src/data/countries.json
    Country code -> English name (GeoNames countryInfo.txt).

src/data/timezones.json
    IANA time zone -> principal city coordinates, from the tz database (public domain):
    zone.tab (one entry per country and zone) plus the `backward` links so old names
    such as Asia/Calcutta resolve. Used to guess a location from the system time zone.

Usage: python3 scripts/build_locations.py
"""

import io
import json
import os
import re
import tempfile
import urllib.request
import zipfile
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
GEONAMES = "https://download.geonames.org/export/dump/"
TZ = "https://raw.githubusercontent.com/eggert/tz/main/"
MIN_POPULATION = 100_000

CACHE = Path(os.environ.get("GEONAMES_CACHE", Path(tempfile.gettempdir()) / "azkar-guard-geonames"))


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "azkar-guard-build/1.0"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        return resp.read()


def cached(name: str) -> Path:
    """Download a GeoNames file once into the cache (alternateNamesV2.zip is ~200 MB)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        print(f"downloading {name}...")
        path.write_bytes(fetch(GEONAMES + name))
    return path


def alternate_names(ids: set[str]) -> dict[str, dict[str, list[tuple[bool, str]]]]:
    """geonameid -> {"ar"|"en": [(preferred, name), ...]} for the given ids."""
    names: dict[str, dict[str, list[tuple[bool, str]]]] = {}
    with zipfile.ZipFile(cached("alternateNamesV2.zip")) as z, z.open("alternateNamesV2.txt") as f:
        for raw in io.TextIOWrapper(f, encoding="utf-8"):
            parts = raw.rstrip("\n").split("\t")
            if len(parts) < 8 or parts[2] not in ("ar", "en") or parts[1] not in ids:
                continue
            if parts[6] == "1" or parts[7] == "1":  # colloquial / historic
                continue
            names.setdefault(parts[1], {}).setdefault(parts[2], []).append((parts[4] == "1", parts[3]))
    return names


def pick(candidates: list[tuple[bool, str]]) -> str:
    """Preferred name first, else the first listed."""
    for preferred, name in candidates:
        if preferred:
            return name
    return candidates[0][1] if candidates else ""


def build_cities() -> tuple[list, dict]:
    countries = {}
    for line in fetch(GEONAMES + "countryInfo.txt").decode("utf-8").splitlines():
        if line and not line.startswith("#"):
            f = line.split("\t")
            countries[f[0]] = f[4]

    selected = []
    with zipfile.ZipFile(cached("cities15000.zip")) as z:
        for line in z.read("cities15000.txt").decode("utf-8").splitlines():
            f = line.split("\t")
            if int(f[14] or 0) >= MIN_POPULATION or f[7] == "PPLC":
                selected.append(f)
    alt = alternate_names({f[0] for f in selected})

    rows = []
    for f in selected:
        names = alt.get(f[0], {})
        extra = []
        for term in [f[2], *(n for _, n in names.get("en", []))]:
            if term and term != f[1] and term not in extra:
                extra.append(term)
        row = [f[1], pick(names.get("ar", [])), f[8], round(float(f[4]), 4), round(float(f[5]), 4), "|".join(extra)]
        rows.append((int(f[14] or 0), row))
    rows.sort(key=lambda r: -r[0])  # most populous first: better default ordering in search
    return [r[1] for r in rows], {cc: countries[cc] for cc in sorted({r[1][2] for r in rows}) if cc in countries}


def build_timezones() -> dict:
    def rows(name: str):
        text = fetch(TZ + name).decode("utf-8")
        return [line.split("\t") for line in text.splitlines() if line and not line.startswith("#")]

    def coords(iso: str) -> tuple[float, float]:
        m = re.match(r"^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$", iso)
        if not m:
            raise ValueError(f"bad coordinates {iso}")
        def dec(sign, d, mi, s):
            return (-1 if sign == "-" else 1) * (int(d) + int(mi) / 60 + int(s or 0) / 3600)
        return round(dec(*m.group(1, 2, 3, 4)), 4), round(dec(*m.group(5, 6, 7, 8)), 4)

    names = {r[0]: r[1] for r in rows("iso3166.tab")}
    zones = {}
    for cc, iso, tz, *_ in rows("zone.tab"):
        lat, lng = coords(iso)
        zones[tz] = [tz.split("/")[-1].replace("_", " "), cc, names.get(cc, cc), lat, lng]  # [city, cc, country, lat, lng]
    for row in rows("backward"):
        parts = [p for p in row if p]
        if len(parts) >= 3 and parts[0] == "Link" and parts[1] in zones and parts[2] not in zones:
            zones[parts[2]] = list(zones[parts[1]])
    return dict(sorted(zones.items()))


def main() -> None:
    cities, countries = build_cities()
    timezones = build_timezones()
    for name, value in (("cities.json", cities), ("countries.json", countries), ("timezones.json", timezones)):
        (DATA / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    with_ar = sum(1 for c in cities if c[1])
    print(f"cities: {len(cities)} ({with_ar} with Arabic names), countries: {len(countries)}, time zones: {len(timezones)}")


if __name__ == "__main__":
    main()
