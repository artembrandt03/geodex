import type { Metadata } from "next";
import { PlayerProfileView } from "@/components/profile/PlayerProfileView";

export const metadata: Metadata = {
  title: "Player | Geodex",
};

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerProfileView id={id} />;
}
