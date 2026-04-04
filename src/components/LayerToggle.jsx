/**
 * @file Map style toggle (Dark / Light / Satellite).
 *
 * @module components/LayerToggle
 */

import { LABELS } from '../config';

const STYLE_KEYS = Object.keys(LABELS.layers);

/**
 * Render a row of icon buttons for switching the map base style.
 *
 * @param {Object} props
 * @param {string}   props.current  - Active style key.
 * @param {Function} props.onChange  - Called with the new style key.
 */
export default function LayerToggle({ current, onChange }) {
  return (
    <div className="flex gap-1">
      {STYLE_KEYS.map((key) => {
        const s = LABELS.layers[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={s.label}
            className={`
              w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all
              ${current === key
                ? 'glass border-amber-500/50 shadow-lg shadow-amber-500/10'
                : 'glass hover:bg-white/10 opacity-70 hover:opacity-100'}
            `}
          >
            {s.icon}
          </button>
        );
      })}
    </div>
  );
}
