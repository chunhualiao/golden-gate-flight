import type { Metadata } from "next";
import { BridgeExperience } from "./components/BridgeExperience";

export const metadata: Metadata = {
  title: "Golden Gate Flight — Interactive 3D Bridge",
  description:
    "Free-fly around a detailed, atmospheric recreation of San Francisco's Golden Gate Bridge.",
};

export default function Home() {
  return (
    <main className="experience-shell">
      <BridgeExperience />
    </main>
  );
}
