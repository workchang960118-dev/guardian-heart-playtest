import { RoomClient } from "@/components/guardian-heart/room-client";

export default async function RoomPage(props: { params: Promise<{ roomCode: string }> }) {
  const params = await props.params;
  return <RoomClient roomCode={params.roomCode} />;
}
