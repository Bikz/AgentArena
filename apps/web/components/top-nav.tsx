"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useAuth } from "@/hooks/useAuth";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const NAV_LINKS = [
  { href: "/", label: "Arenas" },
  { href: "/agents", label: "Agents" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/replay", label: "Replays" },
];

export function TopNav() {
  const { isConnected, address } = useAccount();
  const auth = useAuth();

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
            Agent Arena
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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

        <div className="flex flex-wrap items-center gap-3">
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
                disabled={!isConnected || auth.state === "signing" || auth.state === "loading"}
                onClick={() => auth.signIn()}
                className="underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
              >
                {auth.state === "signing"
                  ? "Signing…"
                  : isConnected
                    ? "Sign in"
                    : "Connect to sign in"}
              </button>
            )}
          </div>
        </div>
      </div>

      {auth.error ? (
        <div className="border-t border-border bg-destructive/10 px-6 py-2 text-xs text-destructive-foreground">
          {auth.error}
        </div>
      ) : null}

      {isConnected && address && !auth.isSignedIn ? (
        <div className="border-t border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
          Connected as {shortAddress(address)} · sign in to join matches
        </div>
      ) : null}
    </nav>
  );
}
