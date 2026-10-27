import { useEffect, useState } from 'react';
import { useGeo, useSettings } from '@/store';
import { APP } from '@/config/env';

/** Live radius options from admin settings (fallback APP). The stored radius is coerced into the allowed set. */
export function useRadius() {
  const opts = useSettings((s) => s.settings?.radiusOptions);
  const def = useSettings((s) => s.settings?.defaultRadiusKm) ?? APP.defaultRadiusKm;
  const options = opts?.length ? opts : APP.radiusOptions;
  const stored = useGeo((s) => s.radiusKm);
  const setRadius = useGeo((s) => s.setRadius);
  const radiusKm = options.includes(stored) ? stored : options.includes(def) ? def : options[0];
  return { radiusKm, options, setRadius };
}

export const useSupport = () => {
  const s = useSettings((x) => x.settings);
  return { email: s?.supportEmail || '', phone: s?.supportPhone || '', version: s?.appVersion || APP.version };
};

/** Debounced copy of a value (search inputs → one API call after typing stops). */
export function useDebounced(v, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}
