// Client-side mirrors of the server rules (Backend lib/core.ts `personName`) so users see errors before submitting.

/** Letters in any script (Hindi too), spaces and . ' - only; 2–80 chars with at least 2 letters. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
export type NameError = 'nameMin' | 'nameNeedLetters' | 'nameLettersOnly' | 'displayNameChars' | null;
export function nameError(raw: string): NameError {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length < 2) return 'nameMin';
  if ((s.match(/\p{L}/gu) ?? []).length < 2) return 'nameNeedLetters';
  if (!NAME_RE.test(s)) return 'nameLettersOnly';
  return null;
}
export const cleanName = (raw: string) => raw.trim().replace(/\s+/g, ' ');

/** Worker display name: business names allowed ("A1 Plumbers", "Sharma & Sons") — digits and & ok, but ≥2 letters. */
const DISPLAY_RE = /^[\p{L}\p{M}\d][\p{L}\p{M}\d .'&-]*$/u;
export function displayNameError(raw: string): NameError {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (s.length < 2) return 'nameMin';
  if ((s.match(/\p{L}/gu) ?? []).length < 2) return 'nameNeedLetters';
  if (!DISPLAY_RE.test(s)) return 'displayNameChars';
  return null;
}
