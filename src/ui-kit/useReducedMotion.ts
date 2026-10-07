import { useEffect, useState } from 'react';
/** Starts reduced during SSR/hydration; subscribes only to this browser's preference. No global state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update();
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
