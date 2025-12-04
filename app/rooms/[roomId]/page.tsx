"use client";

import { useParams } from "next/navigation";
import { RoomGuard } from "./_components/RoomGuard";

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params?.roomId;

  if (!roomId) {
    return <div>ルームIDが見つかりません</div>;
  }

  return <RoomGuard roomId={roomId} />;
}
