// Client-side mirrors of the server rules (Backend lib/core.ts `personName`) so users see errors before submitting.

/** Letters in any script (Hindi too), spaces and . ' - only; 2–80 chars with at least 2 letters. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
export type NameError = 'nameMin' | 'nameLettersOnly' | null;
export function nameError(raw: string): NameError {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length < 2 || (s.match(/\p{L}/gu) ?? []).length < 2) return 'nameMin';
  if (!NAME_RE.test(s)) return 'nameLettersOnly';
  return null;
}
export const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ');
