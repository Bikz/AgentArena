import {
  createAuthRequestMessage,
  createAuthVerifyMessageFromChallenge,
  createECDSAMessageSigner,
  createGetLedgerBalancesMessage,
  createTransferMessage,
  parseAuthRequestResponse,
  parseAuthVerifyResponse,
  parseErrorResponse,
  parseGetLedgerBalancesResponse,
  parseTransferResponse,
  type MessageSigner,
  type RPCAllowance,
} from "@erc7824/nitrolite";
import crypto from "node:crypto";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ClearnodeWs } from "./clearnode.js";
import { YellowSessionStore } from "./session-store.js";

const DEFAULT_WS_URL = "wss://clearnet-sandbox.yellow.com/ws";

function randomHex(bytes: number): Hex {
  return `0x${crypto.randomBytes(bytes).toString("hex")}` as Hex;
}

export class YellowService {
  readonly sessions = new YellowSessionStore();

  private readonly ws: ClearnodeWs;

  constructor(
    log: {
      info: (obj: Record<string, unknown>, msg: string) => void;
      warn: (obj: Record<string, unknown>, msg: string) => void;
      error: (obj: Record<string, unknown>, msg: string) => void;
    },
    private readonly config: {
      wsUrl?: string;
      application: string;
      scope: string;
      defaultAllowances: RPCAllowance[];
      expiresInSeconds: number;
    },
  ) {
    this.ws = new ClearnodeWs(config.wsUrl ?? DEFAULT_WS_URL, log);
  }

  close() {
    this.ws.close();
  }

  async startAuth(wallet: Address) {
    const sessionPrivateKey = randomHex(32);
    const sessionAccount = privateKeyToAccount(sessionPrivateKey);
    const expiresAt = BigInt(Math.floor(Date.now() / 1000) + this.config.expiresInSeconds);

    const authRequest = await createAuthRequestMessage({
      address: wallet,
      session_key: sessionAccount.address,
      application: this.config.application,
      allowances: this.config.defaultAllowances,
      expires_at: expiresAt,
      scope: this.config.scope,
    });

    const raw = await this.ws.request(authRequest, { timeoutMs: 10_000 });

    // Response shape is method=auth_request with challengeMessage.
    // parseAuthRequestResponse throws if not the expected shape.
    let parsed:
      | ReturnType<typeof parseAuthRequestResponse>
      | ReturnType<typeof parseErrorResponse>;
    try {
      parsed = parseAuthRequestResponse(raw);
    } catch {
      parsed = parseErrorResponse(raw);
      throw new Error(parsed.params.error);
    }

    const challenge = (parsed as any).params?.challengeMessage as string | undefined;
    if (!challenge) throw new Error("missing_challenge");

    this.sessions.setPending({
      wallet,
      application: this.config.application,
      scope: this.config.scope,
      sessionKey: sessionAccount.address,
      sessionPrivateKey,
      expiresAt,
      allowances: this.config.defaultAllowances,
      challenge,
      createdAtMs: Date.now(),
    });

    return {
      wallet,
      application: this.config.application,
      scope: this.config.scope,
      sessionKey: sessionAccount.address,
      expiresAt: expiresAt.toString(),
      allowances: this.config.defaultAllowances,
      challenge,
    };
  }

  async verifyAuth(wallet: Address, signature: Hex) {
    const pending = this.sessions.getPending(wallet);
    if (!pending) throw new Error("no_pending_auth");

    const signer: MessageSigner = async (payload) => {
      // Defensive: ensure the payload we are signing is for this exact challenge.
      const method = payload[1];
      const params = payload[2] as any;
      if (method !== "auth_verify") throw new Error("unexpected_method");
      if (!params || params.challenge !== pending.challenge) throw new Error("challenge_mismatch");
      return signature;
    };

    const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, pending.challenge);
    const raw = await this.ws.request(verifyMsg, { timeoutMs: 10_000 });

    let parsed:
      | ReturnType<typeof parseAuthVerifyResponse>
      | ReturnType<typeof parseErrorResponse>;
    try {
      parsed = parseAuthVerifyResponse(raw);
    } catch {
      parsed = parseErrorResponse(raw);
      throw new Error(parsed.params.error);
    }

    if (!parsed.params.success) throw new Error("auth_verify_failed");

    this.sessions.setActive({
      wallet,
      application: pending.application,
      scope: pending.scope,
      sessionKey: pending.sessionKey,
      sessionPrivateKey: pending.sessionPrivateKey,
      expiresAt: pending.expiresAt,
      allowances: pending.allowances,
      jwtToken: parsed.params.jwtToken,
      activatedAtMs: Date.now(),
    });

    return {
      ok: true as const,
      wallet: parsed.params.address,
      sessionKey: parsed.params.sessionKey,
    };
  }

  async getLedgerBalances(wallet: Address) {
    const active = this.sessions.getActive(wallet);
    if (!active) throw new Error("no_active_session");

    const signer = createECDSAMessageSigner(active.sessionPrivateKey);
    const msg = await createGetLedgerBalancesMessage(signer);
    const raw = await this.ws.request(msg, { timeoutMs: 10_000 });

    let parsed:
      | ReturnType<typeof parseGetLedgerBalancesResponse>
      | ReturnType<typeof parseErrorResponse>;
    try {
      parsed = parseGetLedgerBalancesResponse(raw);
    } catch {
      parsed = parseErrorResponse(raw);
      throw new Error(parsed.params.error);
    }

    return parsed.params.ledgerBalances;
  }

  async transfer(wallet: Address, destination: Address, allocations: { asset: string; amount: string }[]) {
    const active = this.sessions.getActive(wallet);
    if (!active) throw new Error("no_active_session");

    const signer = createECDSAMessageSigner(active.sessionPrivateKey);
    const msg = await createTransferMessage(signer, {
      destination,
      allocations,
    });
    const raw = await this.ws.request(msg, { timeoutMs: 10_000 });

    let parsed:
      | ReturnType<typeof parseTransferResponse>
      | ReturnType<typeof parseErrorResponse>;
    try {
      parsed = parseTransferResponse(raw);
    } catch {
      parsed = parseErrorResponse(raw);
      throw new Error(parsed.params.error);
    }

    return parsed.params.transactions;
  }
}
