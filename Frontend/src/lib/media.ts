import { env } from '@/config/env';

/** Resolves a stored media path ("/uploads/avatars/x.jpg") to a loadable URL. External URLs pass through. */
export const mediaUrl = (p?: string | null) => (!p ? undefined : p.startsWith('/uploads/') ? env.backendOrigin + p : p);

/** Client-side guard before uploading (server re-checks type by content). */
export function checkImage(file: File, maxMb = 5, allowPdf = false): string | null {
  const ok = ['image/jpeg', 'image/png', 'image/webp', ...(allowPdf ? ['application/pdf'] : [])];
  if (!ok.includes(file.type)) return `Only JPG, PNG, WEBP${allowPdf ? ' or PDF' : ''} files are allowed`;
  if (file.size > maxMb * 1024 * 1024) return `File too large (max ${maxMb} MB)`;
  return null;
}
