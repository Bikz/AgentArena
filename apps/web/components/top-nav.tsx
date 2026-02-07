"use client";

import Link from "next/link";
import { useAccount, useConnect } from "wagmi";
import type { Connector } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function pickPrimaryConnector(connectors: readonly Connector[]) {
  const available = connectors.filter((connector) =>
    "ready" in connector ? connector.ready : true,
  );
  const injected = available.find((connector) => connector.id === "injected");
  const walletConnect = available.find((connector) => connector.id === "walletConnect");
  return injected ?? walletConnect ?? available[0] ?? null;
}

const NAV_LINKS = [
  { href: "/", label: "Arenas" },
  { href: "/agents", label: "Agents" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/replay", label: "Replays" },
];

const FILTER_LINKS = [
  { href: "/", label: "All" },
  { href: "/?filter=live", label: "Live" },
  { href: "/?filter=upcoming", label: "Upcoming" },
  { href: "/?filter=blitz", label: "Blitz" },
  { href: "/?filter=agents", label: "Agent Arenas" },
];

export function TopNav() {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const auth = useAuth();
  const primaryConnector = pickPrimaryConnector(connectors);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
              Agent Arena
            </Link>
            <div className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative flex-1 min-w-[220px]">
            <input
              type="search"
              placeholder="Search arenas, agents, matches"
              aria-label="Search arenas"
              className="w-full rounded-full border border-border bg-muted/40 px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <ThemeToggle />
            <ConnectWalletButton />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {auth.isSignedIn ? (
                <>
                  <span>Signed in</span>
                  {auth.sessionAddress ? (
                    <Link
                      href={`/players/${auth.sessionAddress}`}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      My profile
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => auth.signOut()}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={
                    auth.state === "signing" ||
                    auth.state === "loading" ||
                    (!isConnected && (isConnecting || !primaryConnector))
                  }
                  onClick={() => {
                    if (isConnected) {
                      void auth.signIn();
                      return;
                    }
                    if (primaryConnector) connect({ connector: primaryConnector });
                  }}
                  className="underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {auth.state === "signing"
                    ? "Signing…"
                    : isConnected
                      ? "Sign in"
                      : isConnecting
                        ? "Connecting…"
                        : "Connect to sign in"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {FILTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-border bg-background px-3 py-1 hover:border-foreground/20 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {auth.error ? (
        <div className="border-t border-border bg-destructive/10 px-6 py-2 text-xs text-destructive-foreground">
          {auth.error}
        </div>
      ) : null}

      {isConnected && address && !auth.isSignedIn ? (
        <div className="border-t border-border bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
          Connected as {shortAddress(address)} · sign in to join matches
        </div>
      ) : null}
    </nav>
  );
}
