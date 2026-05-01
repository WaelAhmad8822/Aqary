import axios from "axios";
import { logger } from "../lib/logger";

export type GeoResult = { canonical?: string; lat?: number; lon?: number } | null;

const CACHE_TTL_MS = Number(process.env.GEOCODE_CACHE_TTL_MS || 1000 * 60 * 60); // 1 hour default
const cache = new Map<string, { ts: number; v: GeoResult }>();

export async function geocode(query: string): Promise<GeoResult> {
  if (!query) return null;
  const key = query.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.v;

  try {
    const url = "https://nominatim.openstreetmap.org/search";
    const res = await axios.get(url, {
      params: {
        q: query,
        format: "json",
        addressdetails: 1,
        limit: 3,
        countrycodes: process.env.GEOCODE_COUNTRY_CODES || undefined,
      },
      headers: {
        "User-Agent": process.env.GEOCODE_USER_AGENT || "Aqary/1.0 (+contact@your-domain.com)",
      },
      timeout: 5000,
    });

    if (!Array.isArray(res.data) || res.data.length === 0) {
      cache.set(key, { ts: Date.now(), v: null });
      return null;
    }

    const r = res.data[0];
    const canonical = r.display_name || null;
    const lat = r.lat ? Number(r.lat) : undefined;
    const lon = r.lon ? Number(r.lon) : undefined;

    const out: GeoResult = { canonical: canonical ?? undefined, lat, lon };
    cache.set(key, { ts: Date.now(), v: out });
    return out;
  } catch (err: any) {
    logger.warn({ err }, "geocode failed");
    cache.set(key, { ts: Date.now(), v: null });
    return null;
  }
}
