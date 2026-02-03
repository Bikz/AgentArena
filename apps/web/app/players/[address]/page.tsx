import { PlayerProfile } from "@/components/player-profile";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <PlayerProfile address={address} />;
}

