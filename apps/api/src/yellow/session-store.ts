import type { RPCAllowance } from "@erc7824/nitrolite";
import type { Address, Hex } from "viem";

export type PendingYellowAuth = {
  wallet: Address;
  application: string;
  scope: string;
  sessionKey: Address;
  sessionPrivateKey: Hex;
  expiresAt: bigint;
  allowances: RPCAllowance[];
  challenge: string;
  createdAtMs: number;
};

export type ActiveYellowSession = {
  wallet: Address;
  application: string;
  scope: string;
  sessionKey: Address;
  sessionPrivateKey: Hex;
  expiresAt: bigint;
  allowances: RPCAllowance[];
  jwtToken?: string;
  activatedAtMs: number;
};

export class YellowSessionStore {
  private pendingByWallet = new Map<string, PendingYellowAuth>();
  private activeByWallet = new Map<string, ActiveYellowSession>();

  private key(wallet: Address) {
    return wallet.toLowerCase();
  }

  setPending(pending: PendingYellowAuth) {
    const k = this.key(pending.wallet);
    this.pendingByWallet.set(k, pending);
  }

  getPending(wallet: Address) {
    return this.pendingByWallet.get(this.key(wallet)) ?? null;
  }

  clearPending(wallet: Address) {
    this.pendingByWallet.delete(this.key(wallet));
  }

  setActive(active: ActiveYellowSession) {
    const k = this.key(active.wallet);
    this.pendingByWallet.delete(k);
    this.activeByWallet.set(k, active);
  }

  getActive(wallet: Address) {
    const k = this.key(wallet);
    const s = this.activeByWallet.get(k);
    if (!s) return null;

    const nowMs = Date.now();
    const expiresMs = Number(s.expiresAt) * 1000;
    if (Number.isFinite(expiresMs) && nowMs >= expiresMs) {
      this.activeByWallet.delete(k);
      return null;
    }

    return s;
  }

  clearActive(wallet: Address) {
    this.activeByWallet.delete(this.key(wallet));
  }
}

