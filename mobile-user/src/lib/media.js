import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { env } from '@/config/env';
import { toast } from '@/store';

/** Resolves a stored media path ("/uploads/avatars/x.jpg") to a loadable URL. External / local URIs pass through. */
export const mediaUrl = (p) => (!p ? undefined : p.startsWith('/uploads/') ? env.backendOrigin + p : p);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const extType = (name = '') => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' })[name.split('.').pop()?.toLowerCase()];

/** Client-side guard before uploading (server re-checks type by content). Same rules as the web's checkImage. */
export function checkFile(file, maxMb = 5, allowPdf = false) {
  const ok = [...IMAGE_TYPES, ...(allowPdf ? ['application/pdf'] : [])];
  if (!ok.includes(file.mimeType)) return `Only JPG, PNG, WEBP${allowPdf ? ' or PDF' : ''} files are allowed`;
  if (file.size && file.size > maxMb * 1024 * 1024) return `File too large (max ${maxMb} MB)`;
  return null;
}

/**
 * Native replacement for the web's hidden <input type="file">: photo library for images, camera capture when
 * `source: 'camera'`, document picker when PDFs are allowed too. Returns validated files as
 * { uri, name, mimeType, size }; invalid ones are rejected with a toast.
 */
export async function pickFiles({ multiple = false, allowPdf = false, max, source = 'gallery' } = {}) {
  if (max !== undefined && max <= 0) return [];
  let picked = [];
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Allow camera access to take a photo', 'error'); return []; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (r.canceled) return [];
    picked = r.assets.map((a, i) => {
      const name = a.fileName || `photo-${Date.now()}-${i}.jpg`;
      return { uri: a.uri, name, mimeType: a.mimeType || extType(name) || 'image/jpeg', size: a.fileSize };
    });
  } else if (allowPdf) {
    const r = await DocumentPicker.getDocumentAsync({ type: [...IMAGE_TYPES, 'application/pdf'], multiple, copyToCacheDirectory: true });
    if (r.canceled) return [];
    picked = r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType || extType(a.name), size: a.size }));
  } else {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? max ?? 0 : 1, quality: 0.85,
    });
    if (r.canceled) return [];
    picked = r.assets.map((a, i) => {
      const name = a.fileName || `photo-${Date.now()}-${i}.jpg`;
      return { uri: a.uri, name, mimeType: a.mimeType || extType(name) || 'image/jpeg', size: a.fileSize };
    });
  }
  const ok = [];
  for (const f of picked) {
    const err = checkFile(f, 5, allowPdf);
    if (err) toast(`${f.name}: ${err}`, 'error');
    else ok.push(f);
  }
  if (max !== undefined && ok.length > max) toast(`You can add ${max} more file${max === 1 ? '' : 's'}`, 'error');
  return max !== undefined ? ok.slice(0, Math.max(0, max)) : ok;
}
