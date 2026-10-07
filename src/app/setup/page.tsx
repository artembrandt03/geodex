import type { Metadata } from "next";
import { SetupScene } from "@/components/landing/SetupScene";

export const metadata: Metadata = {
  title: "Choose a game | Geodex",
  description: "Pick a mode, a difficulty and a round length, then test your geography.",
};

export default function SetupPage() {
  return <SetupScene />;
}
