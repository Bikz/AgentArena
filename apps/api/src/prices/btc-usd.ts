type PriceFeedKind = "simulated" | "coingecko" | "coinbase";

type PriceResult = {
  priceUsd: number;
  source: PriceFeedKind;
  fetchedAtMs: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getFeedKind(): PriceFeedKind {
  const raw = process.env.BTC_PRICE_FEED;
  if (raw === "coingecko" || raw === "coinbase" || raw === "simulated") return raw;
  return "simulated";
}

function parseNumber(value: unknown) {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n;
}

async function fetchCoinGecko(): Promise<number> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`coingecko_http_${res.status}`);
  const json = (await res.json()) as unknown;
  const maybe = (json as any)?.bitcoin?.usd;
  const price = parseNumber(maybe);
  if (price === null) throw new Error("coingecko_parse_error");
  return price;
}

async function fetchCoinbase(): Promise<number> {
  const url = "https://api.coinbase.com/v2/prices/spot?currency=USD";
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`coinbase_http_${res.status}`);
  const json = (await res.json()) as unknown;
  const maybe = (json as any)?.data?.amount;
  const price = parseNumber(maybe);
  if (price === null) throw new Error("coinbase_parse_error");
  return price;
}

export type BtcUsdPriceFeed = (input: {
  matchId: string;
  prevPriceUsd: number;
}) => Promise<PriceResult>;

export function createBtcUsdPriceFeed(): BtcUsdPriceFeed {
  const kind = getFeedKind();
  const rng = mulberry32(hashStringToSeed(`btc_usd_${Date.now()}`));

  let last: PriceResult | null = null;
  const minCacheMs = 5000;

  return async ({ matchId, prevPriceUsd }) => {
    const now = Date.now();
    if (last && now - last.fetchedAtMs <= minCacheMs) return last;

    if (kind === "simulated") {
      const drift = (rng() - 0.5) * 350;
      const next = Math.max(1, prevPriceUsd + drift);
      last = { priceUsd: next, source: "simulated", fetchedAtMs: now };
      return last;
    }

    try {
      const priceUsd = kind === "coingecko" ? await fetchCoinGecko() : await fetchCoinbase();
      last = { priceUsd, source: kind, fetchedAtMs: now };
      return last;
    } catch {
      // Fallback to deterministic-ish simulated drift per match if the external
      // feed is down or rate-limited.
      const fallbackRng = mulberry32(hashStringToSeed(matchId));
      const drift = (fallbackRng() - 0.5) * 350;
      const next = Math.max(1, prevPriceUsd + drift);
      last = {
        priceUsd: clamp(next, 1, Number.MAX_SAFE_INTEGER),
        source: "simulated",
        fetchedAtMs: now,
      };
      return last;
    }
  };
}

