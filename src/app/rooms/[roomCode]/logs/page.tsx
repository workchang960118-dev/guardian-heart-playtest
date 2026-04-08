import { RoomLogsClient } from "@/components/guardian-heart/room-logs-client";

export default async function RoomLogsPage(props: {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{ joinToken?: string; displayName?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  return (
    <RoomLogsClient
      roomCode={params.roomCode}
      initialJoinToken={searchParams.joinToken ?? ""}
      initialDisplayName={searchParams.displayName ?? ""}
    />
  );
}
