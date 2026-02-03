import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /metrics", () => {
  it("returns basic runtime metrics", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;
    expect(typeof json.uptimeSec).toBe("number");
    expect(typeof json.ws?.connections).toBe("number");
    expect(typeof json.queue?.size).toBe("number");
    expect(typeof json.matches?.total).toBe("number");
    expect(typeof json.matches?.active).toBe("number");
    expect(typeof json.matches?.finished).toBe("number");
    await app.close();
  });

  it("exposes Prometheus metrics", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/metrics/prom" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("http_request_duration_ms");
    expect(res.body).toContain("ws_connections");
    expect(res.body).toContain("match_queue_size");
    await app.close();
  });
});
