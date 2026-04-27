/**
 * @file useGeoSearch — centralized Mapbox geocoding with debounce + notifications
 *
 * Exposes a small state machine for search inputs so both desktop and mobile
 * search components can share the same logic and error handling.
 */

import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useNotification } from '../../../shared/hooks/useNotification';
import { MAPBOX_TOKEN, API } from '../../../config';
import { LABELS } from '../../../config';

export function useGeoSearch({ debounceMs = API.searchDebounce } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, debounceMs);
  const { notify } = useNotification();
  const abortRef = useRef(null);

  useEffect(() => {
    // Clear when query is too short
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const encoded = encodeURIComponent(debouncedQuery);
        const url = `${API.geocodingUrl}/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=${API.geocodingLimit}`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error('Geocoding API error');

        const data = await res.json();
        setResults(data.features || []);
        setIsOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          notify(LABELS.geocodingFailed, 'warn');
        }
      }
    })();

    return () => { abortRef.current?.abort(); };
  }, [debouncedQuery, notify, debounceMs]);

  const pickResult = (feature) => {
    if (!feature || !feature.center) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  };

  return { query, setQuery, results, isOpen, setIsOpen, pickResult };
}

export default useGeoSearch;
