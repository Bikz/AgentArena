import { ReplayView } from "@/components/replay-view";

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <ReplayView matchId={matchId} />;
}

