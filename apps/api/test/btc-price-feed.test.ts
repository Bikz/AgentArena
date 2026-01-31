import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createBtcUsdPriceFeed } from "../src/prices/btc-usd.js";

describe("createBtcUsdPriceFeed", () => {
  const prev = process.env.BTC_PRICE_FEED;

  beforeEach(() => {
    process.env.BTC_PRICE_FEED = "simulated";
  });

  afterEach(() => {
    if (prev) process.env.BTC_PRICE_FEED = prev;
    else delete process.env.BTC_PRICE_FEED;
  });

  it("returns a positive price and caches briefly", async () => {
    const feed = createBtcUsdPriceFeed();
    const first = await feed({ matchId: "match_test", prevPriceUsd: 100_000 });
    expect(first.priceUsd).toBeGreaterThan(0);

    const second = await feed({ matchId: "match_test", prevPriceUsd: 100_000 });
    expect(second.priceUsd).toBe(first.priceUsd);
  });
});

