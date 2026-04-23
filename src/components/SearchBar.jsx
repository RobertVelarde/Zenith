/**
 * @file Geocoding search bar using the Mapbox Places API.
 *
 * Debounces user input before issuing requests to avoid spamming the API
 * during rapid typing.  Displays results in a dropdown.
 *
 * @module components/SearchBar
 */

import { useState, useRef, useEffect } from 'react';
import { MAPBOX_TOKEN, API, LABELS } from '../config';
import { useNotification } from '../hooks/notificationContext';

export default function SearchBar({ onSelect, isLight }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);
  const { notify } = useNotification();

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q) => {
    if (q.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const encoded = encodeURIComponent(q);
        const res = await fetch(
          `${API.geocodingUrl}/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=${API.geocodingLimit}`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.features || []);
          setOpen(true);
        } else {
          notify(LABELS.geocodingFailed, 'warn');
        }
      } catch {
        notify(LABELS.geocodingFailed, 'warn');
      }
    }, API.searchDebounce);
  };

  const pick = (feat) => {
    const [lng, lat] = feat.center;
    onSelect({ lat, lng }, feat.place_name);
    setQuery(feat.place_name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-2 ${isLight ? 'glass-light' : 'glass'} rounded-xl px-3 py-2`}>
        <svg className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-400'} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length && setOpen(true)}
          placeholder={LABELS.searchPlaceholder}
          className={`bg-transparent text-xs outline-none w-full ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-500'}`}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className={`text-xs ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-white'}`}>
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className={`absolute z-50 mt-1 w-full ${isLight ? 'glass-light' : 'glass'} rounded-xl overflow-hidden text-sm max-h-60 overflow-y-auto`}>
          {results.map((f) => (
            <li
              key={f.id}
              onClick={() => pick(f)}
              className={`px-3 py-2 cursor-pointer truncate ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-200 hover:bg-white/10'}`}
            >
              {f.place_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
