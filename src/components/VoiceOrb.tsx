import { Component, lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";

const OfficialOrb = lazy(() => import("./ui/orb").then((module) => ({ default: module.Orb })));
export type VoicePhase = "connecting" | "listening" | "thinking" | "speaking" | "muted" | "unavailable";
interface VoiceOrbProps {
  phase: VoicePhase;
  active: boolean;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}
const silence = () => 0;
const safeLevel = (read?: () => number) => {
  try {
    const value = read?.() ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  } catch { return 0; }
};
const staticOrb = <div className="voice-orb-visual voice-orb-static" aria-hidden="true" />;
class OrbBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? staticOrb : this.props.children; }
}
/** Visualización decorativa: Ionic no ofrece un equivalente al orbe de audio. */
export function VoiceOrb({ phase, active, getInputVolume, getOutputVolume }: VoiceOrbProps) {
  const [colors] = useState<[string, string]>(() => {
    const theme = getComputedStyle(document.documentElement);
    return [theme.getPropertyValue("--brand-navy-deep").trim() || "#023467", theme.getPropertyValue("--ice").trim() || "#87aeca"];
  });
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    if (!active) return;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [active]);
  if (!active) return null;
  if (reduced || failed || phase === "muted" || phase === "unavailable") return staticOrb;
  const agentState = phase === "speaking" ? "talking" : phase === "connecting" ? null : phase;
  return (
    <OrbBoundary>
      <Suspense fallback={staticOrb}>
        <OfficialOrb className="voice-orb-visual" seed={42}
          colors={colors} agentState={agentState} volumeMode="manual"
          getInputVolume={phase === "listening" ? () => safeLevel(getInputVolume) : silence}
          getOutputVolume={phase === "speaking" ? () => safeLevel(getOutputVolume) : silence}
          onFailure={() => setFailed(true)} />
      </Suspense>
    </OrbBoundary>
  );
}
