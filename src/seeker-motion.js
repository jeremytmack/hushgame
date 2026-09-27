// A repeatable stop / catch-up cadence shared by navigation and animation.
// Its average is normalized to one, preserving the existing search speed.
const CADENCE = [
  [0, 0.65], [0.10, 0.65], [0.15, 1.45], [0.37, 1.45],
  [0.42, 0.78], [0.51, 0.78], [0.55, 0.32], [0.66, 0.32],
  [0.72, 1.6], [0.91, 1.6], [0.97, 0.65], [1, 0.65],
];
const MEAN = CADENCE.slice(1).reduce((sum, [x, y], i) =>
  sum + (x - CADENCE[i][0]) * (y + CADENCE[i][1]) / 2, 0);

export function seekerPace(time, reduced = false) {
  if (reduced) return 1;
  const phase = ((time % 4.8) + 4.8) % 4.8 / 4.8;
  const index = CADENCE.findIndex(([x]) => x > phase);
  const [a, start] = CADENCE[index - 1];
  const [b, end] = CADENCE[index];
  const progress = (phase - a) / (b - a);
  // Smooth acceleration into each burst without changing its average.
  const blend = progress * progress * (3 - 2 * progress);
  return (start + (end - start) * blend) / MEAN;
}

export function seekerGesture(time, reduced = false) {
  if (reduced) return { tilt: 0.08, twitch: 0, curl: 0.18, blink: 0 };
  const cycle = ((time % 9.7) + 9.7) % 9.7;
  const pulse = (start, duration) => {
    const p = (cycle - start) / duration;
    return p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
  };
  return {
    tilt: cycle < 6.3 ? 0.25 : -0.34,
    twitch: pulse(6.32, 0.16) * 0.085 - pulse(6.55, 0.12) * 0.045,
    curl: 0.18 + pulse(3.6, 1.9) * 0.27,
    // A late, incomplete blink, separated by an unnaturally long stare.
    blink: pulse(8.85, 0.16) * 0.7,
  };
}

// Start the warning far enough away to see it, fully open before capture range.
export function seekerThreat(distance, aware = true) {
  if (!aware || !Number.isFinite(distance)) return 0;
  const t = Math.max(0, Math.min(1, (7.5 - distance) / 6.1));
  return t * t * (3 - 2 * t);
}
