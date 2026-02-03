import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  getAddress,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const settlementAbi = parseAbi([
  "function depositMatchPot(bytes32 matchId, uint256 amount)",
  "function settleMatch(bytes32 matchId, address winner, address rakeRecipient, uint16 rakeBps)",
]);

type Logger = {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
};

export class OnchainSettlementService {
  private readonly enabled: boolean;
  private readonly log: Logger;
  private readonly publicClient?: ReturnType<typeof createPublicClient>;
  private readonly walletClient?: ReturnType<typeof createWalletClient>;
  private readonly tokenAddress?: Address;
  private readonly contractAddress?: Address;
  private readonly account?: ReturnType<typeof privateKeyToAccount>;
  private readonly rakeRecipient?: Address;
  private readonly rakeBps?: number;

  constructor(
    log: Logger,
    config: {
      enabled: boolean;
      rpcUrl?: string;
      tokenAddress?: string;
      contractAddress?: string;
      housePrivateKey?: Hex;
      rakeRecipient?: string;
      rakeBps?: number;
    },
  ) {
    this.log = log;
    if (!config.enabled) {
      this.enabled = false;
      return;
    }
    if (!config.rpcUrl || !config.tokenAddress || !config.contractAddress || !config.housePrivateKey) {
      log.error(
        {
          rpcUrl: Boolean(config.rpcUrl),
          tokenAddress: Boolean(config.tokenAddress),
          contractAddress: Boolean(config.contractAddress),
          housePrivateKey: Boolean(config.housePrivateKey),
        },
        "onchain settlement enabled but missing config",
      );
      this.enabled = false;
      return;
    }

    const account = privateKeyToAccount(config.housePrivateKey);
    const tokenAddress = getAddress(config.tokenAddress);
    const contractAddress = getAddress(config.contractAddress);
    const rakeRecipient = config.rakeRecipient ? getAddress(config.rakeRecipient) : account.address;
    const rakeBps = config.rakeBps ?? 0;

    this.enabled = true;
    this.account = account;
    this.tokenAddress = tokenAddress;
    this.contractAddress = contractAddress;
    this.rakeRecipient = rakeRecipient;
    this.rakeBps = rakeBps;
    this.publicClient = createPublicClient({
      transport: http(config.rpcUrl),
    });
    this.walletClient = createWalletClient({
      account,
      transport: http(config.rpcUrl),
    });
  }

  isEnabled() {
    return this.enabled;
  }

  getConfig() {
    return {
      enabled: this.enabled,
      contractAddress: this.contractAddress ?? null,
      tokenAddress: this.tokenAddress ?? null,
      houseAddress: this.account?.address ?? null,
      rakeRecipient: this.rakeRecipient ?? null,
      rakeBps: this.rakeBps ?? null,
    };
  }

  private matchKey(matchId: string): Hex {
    return keccak256(toBytes(matchId));
  }

  private async ensureAllowance(amount: bigint) {
    if (!this.enabled || !this.publicClient || !this.walletClient) return;
    const account = this.account;
    if (!account || !this.tokenAddress || !this.contractAddress) return;
    const allowance = await this.publicClient.readContract({
      address: this.tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, this.contractAddress],
    });
    if (allowance >= amount) return;
    const hash = await this.walletClient.writeContract({
      address: this.tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.contractAddress, maxUint256],
      account,
      chain: null,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  async fundMatch(matchId: string, amount: bigint) {
    if (!this.enabled || !this.publicClient || !this.walletClient) return null;
    const account = this.account;
    if (!this.contractAddress || !account) return null;
    if (amount <= 0n) return null;

    await this.ensureAllowance(amount);
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: settlementAbi,
      functionName: "depositMatchPot",
      args: [this.matchKey(matchId), amount],
      account,
      chain: null,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, matchKey: this.matchKey(matchId) };
  }

  async settleMatch(matchId: string, winner: Address, rakeBpsOverride?: number) {
    if (!this.enabled || !this.publicClient || !this.walletClient) return null;
    const account = this.account;
    if (!this.contractAddress || !this.rakeRecipient || !account) return null;
    const rakeBps = rakeBpsOverride ?? this.rakeBps ?? 0;
    if (rakeBps < 0 || rakeBps > 10_000) {
      throw new Error("invalid_rake_bps");
    }
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: settlementAbi,
      functionName: "settleMatch",
      args: [this.matchKey(matchId), winner, this.rakeRecipient, rakeBps],
      account,
      chain: null,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, matchKey: this.matchKey(matchId) };
  }
}
