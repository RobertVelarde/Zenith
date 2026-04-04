/**
 * @file Reusable key-value row used across Solar, Lunar, and Advanced panels.
 *
 * @module components/DataRow
 */

/**
 * Render a single label / value pair with consistent styling.
 *
 * @param {Object} props
 * @param {string}  props.label   - Left-side descriptive text.
 * @param {string}  props.value   - Right-side data value.
 * @param {string}  [props.color] - Tailwind text-color class for the value (dark mode).
 * @param {boolean} [props.isLight] - Whether the light theme is active.
 */
export default function DataRow({ label, value, color = 'text-gray-200', isLight }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{label}</span>
      <span className={`font-mono text-xs ${isLight ? 'text-slate-800' : color}`}>{value}</span>
    </div>
  );
}
