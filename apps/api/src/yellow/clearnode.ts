import WebSocket, { type RawData } from "ws";
import { getRequestId } from "@erc7824/nitrolite";

type Pending = {
  resolve: (raw: string) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

export class ClearnodeWs {
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private pendingByReqId = new Map<number, Pending>();

  constructor(
    private readonly url: string,
    private readonly log: {
      info: (obj: Record<string, unknown>, msg: string) => void;
      warn: (obj: Record<string, unknown>, msg: string) => void;
      error: (obj: Record<string, unknown>, msg: string) => void;
    },
  ) {}

  private async ensureConnected() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.on("open", () => {
        this.log.info({ url: this.url }, "clearnode ws connected");
        resolve();
      });

      ws.on("message", (data: RawData) => {
        const raw = data.toString();
        try {
          const parsed = JSON.parse(raw);
          const reqId = getRequestId(parsed);
          if (typeof reqId !== "number") return;

          const pending = this.pendingByReqId.get(reqId);
          if (!pending) return;

          clearTimeout(pending.timeout);
          this.pendingByReqId.delete(reqId);
          pending.resolve(raw);
        } catch {
          // ignore unparsable
        }
      });

      ws.on("close", (code: number, reason: Buffer) => {
        this.log.warn({ code, reason: reason.toString() }, "clearnode ws closed");
        for (const [reqId, pending] of this.pendingByReqId) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("clearnode_disconnected"));
          this.pendingByReqId.delete(reqId);
        }
        this.ws = null;
        this.connecting = null;
      });

      ws.on("error", (err: Error) => {
        this.log.error({ err }, "clearnode ws error");
        reject(err);
      });
    });

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async request(message: string, { timeoutMs }: { timeoutMs: number }) {
    await this.ensureConnected();
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("clearnode_not_connected");

    const reqId = (() => {
      try {
        const parsed = JSON.parse(message);
        const id = getRequestId(parsed);
        return typeof id === "number" ? id : null;
      } catch {
        return null;
      }
    })();
    if (reqId == null) throw new Error("missing_request_id");

    if (this.pendingByReqId.has(reqId)) throw new Error("duplicate_request_id");

    const raw = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingByReqId.delete(reqId);
        reject(new Error("clearnode_timeout"));
      }, timeoutMs);

      this.pendingByReqId.set(reqId, { resolve, reject, timeout });
      ws.send(message);
    });

    return raw;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // ignore
    } finally {
      this.ws = null;
      this.connecting = null;
      for (const [reqId, pending] of this.pendingByReqId) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("clearnode_closed"));
        this.pendingByReqId.delete(reqId);
      }
    }
  }
}
