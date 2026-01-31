import type { ServerEvent } from "@agent-arena/shared";

export type Strategy = "hold" | "random" | "trend" | "mean_revert";

export type Seat = {
  seatId: string;
  agentName: string;
  strategy: Strategy;
  credits: number;
  target: number;
};

export type MatchPhase = "waiting" | "running" | "finished";

export type MatchConfig = {
  matchId: string;
  tickIntervalMs: number;
  maxTicks: number;
  startPrice: number;
};

export type MatchState = {
  config: MatchConfig;
  phase: MatchPhase;
  tick: number;
  price: number;
  prevPrice: number;
  seats: Seat[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

type Broadcast = (matchId: string, event: ServerEvent) => void;
type BroadcastAll = (event: ServerEvent) => void;

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sign(n: number) {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

export class MatchEngine {
  private matchById = new Map<string, MatchState>();
  private queue: Array<Pick<Seat, "agentName" | "strategy">> = [];
  private runningTimerByMatchId = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly broadcast: Broadcast,
    private readonly broadcastAll: BroadcastAll,
  ) {}

  getQueueSize() {
    return this.queue.length;
  }

  getMatch(matchId: string) {
    return this.matchById.get(matchId);
  }

  getLatestMatchId() {
    const matches = Array.from(this.matchById.values()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    return matches[0]?.config.matchId;
  }

  joinQueue(agentName: string, strategy: Strategy) {
    this.queue.push({ agentName, strategy });
    this.broadcastAll({ type: "queue", v: 1, queueSize: this.queue.length });

    if (this.queue.length >= 5) {
      const seats = this.queue.splice(0, 5);
      const matchId = `match_${Date.now()}`;
      this.createAndStartMatch({
        matchId,
        tickIntervalMs: 1500,
        maxTicks: 40,
        startPrice: 100_000,
      }, seats);
    }
  }

  leaveQueue() {
    // For now: remove one seat from the back (we don't identify the caller yet).
    if (this.queue.length === 0) return;
    this.queue.pop();
    this.broadcastAll({ type: "queue", v: 1, queueSize: this.queue.length });
  }

  private createAndStartMatch(
    config: MatchConfig,
    queued: Array<Pick<Seat, "agentName" | "strategy">>,
  ) {
    const seats: Seat[] = queued.map((q, idx) => ({
      seatId: String(idx + 1),
      agentName: q.agentName,
      strategy: q.strategy,
      credits: 1000,
      target: 0,
    }));

    const state: MatchState = {
      config,
      phase: "waiting",
      tick: 0,
      price: config.startPrice,
      prevPrice: config.startPrice,
      seats,
      createdAt: Date.now(),
    };
    this.matchById.set(config.matchId, state);

    this.broadcastAll({
      type: "match_status",
      v: 1,
      matchId: config.matchId,
      phase: state.phase,
      seats: state.seats.map((s) => ({
        seatId: s.seatId,
        agentName: s.agentName,
        strategy: s.strategy,
      })),
      tickIntervalMs: config.tickIntervalMs,
      maxTicks: config.maxTicks,
    });

    this.startMatch(config.matchId);
  }

  private startMatch(matchId: string) {
    const match = this.matchById.get(matchId);
    if (!match || match.phase !== "waiting") return;
    match.phase = "running";
    match.startedAt = Date.now();

    const rng = mulberry32(hashStringToSeed(matchId));

    const timer = setInterval(() => {
      const current = this.matchById.get(matchId);
      if (!current) return;
      if (current.phase !== "running") return;

      const nextTick = current.tick + 1;
      const prev = current.price;
      const drift = (rng() - 0.5) * 350; // placeholder volatility
      const nextPrice = Math.max(1, prev + drift);

      current.tick = nextTick;
      current.prevPrice = prev;
      current.price = nextPrice;

      this.applyStrategies(current, rng);
      this.applyScoring(current);

      this.broadcast(matchId, {
        type: "tick",
        tick: {
          matchId,
          tick: current.tick,
          ts: Date.now(),
          btcPrice: current.price,
        },
      });

      this.broadcast(matchId, {
        type: "leaderboard",
        matchId,
        tick: current.tick,
        rows: current.seats.map((s) => ({
          seatId: s.seatId,
          agentName: s.agentName,
          credits: s.credits,
          target: s.target,
        })),
      });

      if (current.tick >= current.config.maxTicks) {
        current.phase = "finished";
        current.finishedAt = Date.now();
        const active = this.runningTimerByMatchId.get(matchId);
        if (active) clearInterval(active);
        this.runningTimerByMatchId.delete(matchId);

        this.broadcastAll({
          type: "match_status",
          v: 1,
          matchId,
          phase: current.phase,
          seats: current.seats.map((s) => ({
            seatId: s.seatId,
            agentName: s.agentName,
            strategy: s.strategy,
          })),
          tickIntervalMs: current.config.tickIntervalMs,
          maxTicks: current.config.maxTicks,
        });
      }
    }, match.config.tickIntervalMs);

    this.runningTimerByMatchId.set(matchId, timer);
  }

  private applyStrategies(match: MatchState, rng: () => number) {
    const delta = match.price - match.prevPrice;
    const d = sign(delta);

    for (const seat of match.seats) {
      let nextTarget = seat.target;
      if (seat.strategy === "hold") nextTarget = 0;
      if (seat.strategy === "random") nextTarget = rng() * 2 - 1;
      if (seat.strategy === "trend") nextTarget = d * 0.5;
      if (seat.strategy === "mean_revert") nextTarget = -d * 0.5;
      seat.target = clamp(nextTarget, -1, 1);
    }
  }

  private applyScoring(match: MatchState) {
    const priceChangePct = (match.price - match.prevPrice) / match.prevPrice;
    const K = 15; // visibility multiplier (demo)
    const fee = 0.0005; // friction

    for (const seat of match.seats) {
      const perf = 1 + seat.target * priceChangePct * K - fee;
      seat.credits = Math.max(0, seat.credits * perf);
    }
  }

  close() {
    for (const timer of this.runningTimerByMatchId.values()) clearInterval(timer);
    this.runningTimerByMatchId.clear();
    this.matchById.clear();
    this.queue = [];
  }
}

