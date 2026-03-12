import { useState, useEffect } from "react";

/**
 * Returns a debounced value that updates after `delay` ms of no changes.
 * Use for search inputs to avoid firing API calls on every keystroke.
 * @param {*} value - Value to debounce
 * @param {number} delay - Delay in ms (default 400)
 * @returns {*} Debounced value
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
