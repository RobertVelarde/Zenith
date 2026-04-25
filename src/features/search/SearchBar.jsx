/**
 * @file Geocoding search bar using the Mapbox Places API.
 *
 * Debounces user input before issuing requests to avoid spamming the API
 * during rapid typing.  Displays results in a dropdown.
 *
 * @module components/SearchBar
 */

import { useRef, useEffect } from 'react';
import { API, LABELS } from '../../config';
import useGeoSearch from './hooks/useGeoSearch';

export default function SearchBar({ onSelect, isLight }) {
  const wrapRef = useRef(null);
  const { query, setQuery, results, isOpen, setIsOpen, pickResult } = useGeoSearch({ debounceMs: API.searchDebounce });

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (feat) => {
    const p = pickResult(feat);
    if (p) onSelect(p, feat.place_name);
    setQuery(feat.place_name);
    setIsOpen(false);
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
          onChange={(e) => { setQuery(e.target.value); }}
          onFocus={() => results.length && setIsOpen(true)}
          placeholder={LABELS.searchPlaceholder}
          className={`bg-transparent text-xs outline-none w-full ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-gray-500'}`}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); }} className={`text-xs ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-white'}`}>
            ✕
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
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
