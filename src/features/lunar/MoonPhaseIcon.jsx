/**
 * @file SVG moon-phase icon rendered from the phase fraction.
 *
 * Draws a crescent / gibbous shape by combining two circular arcs whose
 * relative curvature is controlled by the phase value.
 *
 * @module components/MoonPhaseIcon
 */

/**
 * @param {Object} props
 * @param {number} props.phase - Moon phase fraction (0 = new, 0.5 = full).
 * @param {number} [props.size=28] - SVG width/height in px.
 */
export default function MoonPhaseIcon({ phase, size = 28 }) {
  // phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
  const r = size / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;

  // Create crescent/gibbous path using two arcs
  // Illuminated fraction goes from right side (waxing) to left side (waning)
  let d;
  const sweep = phase <= 0.5 ? phase * 2 : (1 - phase) * 2; // 0→1→0

  // Inner arc control: 1 = full circle (full moon), 0 = straight line (quarter), -1 = opposite
  const inner = (sweep - 0.5) * 2 * r; // range: -r to +r

  if (phase <= 0.5) {
    // Waxing: illuminated on right side
    d = `M ${cx} ${cy - r}
         A ${r} ${r} 0 0 1 ${cx} ${cy + r}
         A ${Math.abs(inner)} ${r} 0 0 ${inner >= 0 ? 1 : 0} ${cx} ${cy - r} Z`;
  } else {
    // Waning: illuminated on left side
    d = `M ${cx} ${cy - r}
         A ${r} ${r} 0 0 0 ${cx} ${cy + r}
         A ${Math.abs(inner)} ${r} 0 0 ${inner >= 0 ? 0 : 1} ${cx} ${cy - r} Z`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background (dark side) */}
      <circle cx={cx} cy={cy} r={r} fill="#334155" stroke="#64748b" strokeWidth={0.5} />
      {/* Illuminated portion */}
      <path d={d} fill="#e2e8f0" opacity={0.9} />
    </svg>
  );
}
