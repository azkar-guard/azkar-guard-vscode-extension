// Record reference Fajr/Maghrib times from the AlAdhan API, so prayer.test.ts can check the
// on-device adhan-js calculation against it without calling the network.
// Usage: node scripts/build_aladhan_fixtures.mjs
import { writeFileSync } from "node:fs";

const CITIES = {
  Cairo: [30.0626, 31.2497],
  Makkah: [21.4266, 39.8256],
  Istanbul: [41.0138, 28.9497],
  London: [51.5085, -0.1257],
  "New York": [40.7143, -74.006],
  Jakarta: [-6.2146, 106.8451],
  "Kuala Lumpur": [3.1412, 101.6865],
  Casablanca: [33.5883, -7.6114],
  Oslo: [59.9127, 10.7461],
};
const DATES = ["2026-06-21", "2026-12-21"];
const METHODS = [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23];

const jobs = [];
for (const method of METHODS) for (const [city, [lat, lng]] of Object.entries(CITIES)) for (const date of DATES) jobs.push({ method, city, lat, lng, date });

const out = [];
const worker = async () => {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const [y, m, d] = job.date.split("-");
    const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${job.lat}&longitude=${job.lng}&method=${job.method}&iso8601=true`;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        const t = (await res.json()).data.timings;
        out.push({ ...job, fajr: t.Fajr, maghrib: t.Maghrib });
        break;
      }
      if (attempt >= 5) throw new Error(`${url}: HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
};
await Promise.all(Array.from({ length: 4 }, worker));
out.sort((a, b) => a.method - b.method || a.city.localeCompare(b.city) || a.date.localeCompare(b.date));
writeFileSync(new URL("../src/lib/fixtures/aladhan.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`recorded ${out.length} reference times`);
