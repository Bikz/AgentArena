import { AgentProfile } from "@/components/agent-profile";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentProfile agentId={agentId} />;
}

