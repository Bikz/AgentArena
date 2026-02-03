import client from "prom-client";

const register = new client.Registry();
register.setDefaultLabels({ service: "agent-arena-api" });

client.collectDefaultMetrics({ register });

const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

const wsConnections = new client.Gauge({
  name: "ws_connections",
  help: "Active websocket connections",
  registers: [register],
});

const queueSize = new client.Gauge({
  name: "match_queue_size",
  help: "Current match queue size",
  registers: [register],
});

const matchesTotal = new client.Gauge({
  name: "matches_total",
  help: "Total matches tracked by engine",
  registers: [register],
});

const matchesActive = new client.Gauge({
  name: "matches_active",
  help: "Matches currently running or waiting",
  registers: [register],
});

const matchesFinished = new client.Gauge({
  name: "matches_finished",
  help: "Matches finished",
  registers: [register],
});

export function observeHttpRequest(input: {
  method: string;
  route: string;
  status: number;
  durationMs: number;
}) {
  httpRequestDurationMs.observe(
    {
      method: input.method,
      route: input.route,
      status: String(input.status),
    },
    input.durationMs,
  );
}

export function updateRuntimeMetrics(input: {
  wsConnections: number;
  queueSize: number;
  matches: { total: number; active: number; finished: number };
}) {
  wsConnections.set(input.wsConnections);
  queueSize.set(input.queueSize);
  matchesTotal.set(input.matches.total);
  matchesActive.set(input.matches.active);
  matchesFinished.set(input.matches.finished);
}

export function metricsContentType() {
  return register.contentType;
}

export async function renderMetrics() {
  return register.metrics();
}
