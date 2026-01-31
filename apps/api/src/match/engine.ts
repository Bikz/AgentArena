import type { AgentDecision, MatchTick, ServerEvent } from "@agent-arena/shared";

export type Strategy = "hold" | "random" | "trend" | "mean_revert";

export type PriceFeed = (input: {
  match: MatchState;
  timeoutMs: number;
}) => Promise<{ price: number; source?: string }>;

export type Seat = {
  seatId: string;
  agentId?: string;
  agentName: string;
  strategy: Strategy;
  ownerAddress?: string;
  credits: number;
  target: number;
  note?: string;
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
  priceHistory: number[];
  seats: Seat[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

type Broadcast = (matchId: string, event: ServerEvent) => void;
type BroadcastAll = (event: ServerEvent) => void;
export type SeatDecider = (input: {
  seat: Seat;
  match: MatchState;
  latestTick: MatchTick;
  timeoutMs: number;
  rng: () => number;
}) => Promise<AgentDecision>;
type EngineHooks = {
  onMatchCreated?: (match: MatchState) => void | Promise<void>;
  onTick?: (match: MatchState) => void | Promise<void>;
  onFinished?: (match: MatchState) => void | Promise<void>;
  onError?: (err: unknown) => void;
};

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

export class MatchEngine {
  private matchById = new Map<string, MatchState>();
  private queue: Array<
    Pick<Seat, "agentId" | "agentName" | "strategy" | "ownerAddress"> & {
      clientId: string;
    }
  > = [];
  private runningTimerByMatchId = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly broadcast: Broadcast,
    private readonly broadcastAll: BroadcastAll,
    private readonly decideSeat?: SeatDecider,
    private readonly priceFeed?: PriceFeed,
    private readonly hooks?: EngineHooks,
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

  joinQueue(input: {
    clientId: string;
    ownerAddress?: string;
    agentId?: string;
    agentName: string;
    strategy: Strategy;
  }) {
    if (this.queue.some((q) => q.clientId === input.clientId)) return;
    this.queue.push({
      clientId: input.clientId,
      ownerAddress: input.ownerAddress,
      agentId: input.agentId,
      agentName: input.agentName,
      strategy: input.strategy,
    });
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

  leaveQueue(clientId: string) {
    const next = this.queue.filter((q) => q.clientId !== clientId);
    if (next.length === this.queue.length) return;
    this.queue = next;
    this.broadcastAll({ type: "queue", v: 1, queueSize: this.queue.length });
  }

  private createAndStartMatch(
    config: MatchConfig,
    queued: Array<
      Pick<Seat, "agentId" | "agentName" | "strategy" | "ownerAddress"> & {
        clientId: string;
      }
    >,
  ) {
    const seats: Seat[] = queued.map((q, idx) => ({
      seatId: String(idx + 1),
      agentId: q.agentId,
      agentName: q.agentName,
      strategy: q.strategy,
      ownerAddress: q.ownerAddress,
      credits: 1000,
      target: 0,
    }));

    const state: MatchState = {
      config,
      phase: "waiting",
      tick: 0,
      price: config.startPrice,
      prevPrice: config.startPrice,
      priceHistory: [config.startPrice],
      seats,
      createdAt: Date.now(),
    };
    this.matchById.set(config.matchId, state);
    void Promise.resolve(this.hooks?.onMatchCreated?.(state)).catch((err) =>
      this.hooks?.onError?.(err),
    );

    this.broadcastAll({
      type: "match_status",
      v: 1,
      matchId: config.matchId,
      phase: state.phase,
      seats: state.seats.map((s) => ({
        seatId: s.seatId,
        agentId: s.agentId,
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

    this.broadcastAll({
      type: "match_status",
      v: 1,
      matchId,
      phase: match.phase,
      seats: match.seats.map((s) => ({
        seatId: s.seatId,
        agentId: s.agentId,
        agentName: s.agentName,
        strategy: s.strategy,
      })),
      tickIntervalMs: match.config.tickIntervalMs,
      maxTicks: match.config.maxTicks,
    });

    const runTick = async () => {
      const current = this.matchById.get(matchId);
      if (!current || current.phase !== "running") return;

      const tickStartedAt = Date.now();
      const feedTimeoutMs = Math.max(250, Math.floor(current.config.tickIntervalMs / 2));

      const nextTick = current.tick + 1;
      const prev = current.price;
      const nextPrice = await this.getNextPrice({
        match: current,
        prev,
        rng,
        timeoutMs: feedTimeoutMs,
      });

      current.tick = nextTick;
      current.prevPrice = prev;
      current.price = nextPrice;
      current.priceHistory = [...current.priceHistory, nextPrice].slice(-20);

      // Score based on prior target over the last interval.
      this.applyScoring(current);

      const latestTick: MatchTick = {
        matchId,
        tick: current.tick,
        ts: Date.now(),
        btcPrice: current.price,
      };

      // Decide next target for the upcoming interval (defaults to HOLD).
      await this.applyDecisions(current, latestTick, rng);

      this.broadcast(matchId, { type: "tick", tick: latestTick });
      this.broadcast(matchId, {
        type: "leaderboard",
        matchId,
        tick: current.tick,
        rows: current.seats.map((s) => ({
          seatId: s.seatId,
          agentId: s.agentId,
          agentName: s.agentName,
          credits: s.credits,
          target: s.target,
          note: s.note,
        })),
      });

      void Promise.resolve(this.hooks?.onTick?.(current)).catch((err) =>
        this.hooks?.onError?.(err),
      );

      if (current.tick >= current.config.maxTicks) {
        current.phase = "finished";
        current.finishedAt = Date.now();
        const active = this.runningTimerByMatchId.get(matchId);
        if (active) clearTimeout(active);
        this.runningTimerByMatchId.delete(matchId);

        void Promise.resolve(this.hooks?.onFinished?.(current)).catch((err) =>
          this.hooks?.onError?.(err),
        );

        this.broadcastAll({
          type: "match_status",
          v: 1,
          matchId,
          phase: current.phase,
          seats: current.seats.map((s) => ({
            seatId: s.seatId,
            agentId: s.agentId,
            agentName: s.agentName,
            strategy: s.strategy,
          })),
          tickIntervalMs: current.config.tickIntervalMs,
          maxTicks: current.config.maxTicks,
        });
        return;
      }

      const elapsed = Date.now() - tickStartedAt;
      const delay = Math.max(0, current.config.tickIntervalMs - elapsed);
      const timer = setTimeout(() => void runTick(), delay);
      this.runningTimerByMatchId.set(matchId, timer);
    };

    const firstDelay = Math.min(250, match.config.tickIntervalMs);
    const first = setTimeout(() => void runTick(), firstDelay);
    this.runningTimerByMatchId.set(matchId, first);
  }

  private async applyDecisions(
    match: MatchState,
    latestTick: MatchTick,
    rng: () => number,
  ) {
    const timeoutMs = Math.max(250, match.config.tickIntervalMs - 100);

    await Promise.all(
      match.seats.map(async (seat) => {
        if (!this.decideSeat) {
          seat.target = 0;
          seat.note = "hold";
          return;
        }

        try {
          const decision = await this.decideSeat({
            seat,
            match,
            latestTick,
            timeoutMs,
            rng,
          });
          seat.target = clamp(decision.target, -1, 1);
          seat.note = decision.note;
        } catch {
          seat.target = 0;
          seat.note = "hold";
        }
      }),
    );
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

  private async getNextPrice(input: {
    match: MatchState;
    prev: number;
    rng: () => number;
    timeoutMs: number;
  }) {
    if (!this.priceFeed) {
      const drift = (input.rng() - 0.5) * 350;
      return Math.max(1, input.prev + drift);
    }

    try {
      const res = await this.priceFeed({ match: input.match, timeoutMs: input.timeoutMs });
      if (typeof res.price === "number" && Number.isFinite(res.price) && res.price > 0) {
        return res.price;
      }
    } catch {
      // fall through
    }

    const drift = (input.rng() - 0.5) * 350;
    return Math.max(1, input.prev + drift);
  }
}
