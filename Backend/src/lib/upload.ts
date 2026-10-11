import { mkdirSync, openSync, readSync, closeSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from './core.js';

/**
 * Local-disk storage. Public files (avatars, portfolio, chat images) are served at /uploads/*.
 * Private files (verification docs, complaint evidence) are never served statically — only through
 * admin-authenticated, audit-logged endpoints. Swap this module for S3/GCS signed URLs later.
 */
export const PUBLIC_ROOT = path.resolve(env.UPLOAD_DIR);
export const PRIVATE_ROOT = path.resolve(env.PRIVATE_UPLOAD_DIR);

const IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const DOC = [...IMAGE, 'application/pdf'];
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };

// Magic bytes — the browser-supplied MIME type is not trusted on its own.
const SIGNATURES: [string, (b: Buffer) => boolean][] = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/webp', (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'],
  ['application/pdf', (b) => b.subarray(0, 5).toString() === '%PDF-'],
];
function sniff(file: string) {
  const fd = openSync(file, 'r');
  const b = Buffer.alloc(12);
  readSync(fd, b, 0, 12, 0);
  closeSync(fd);
  return SIGNATURES.find(([, test]) => test(b))?.[0];
}

type Kind = 'avatars' | 'portfolio' | 'chat' | 'verification' | 'evidence' | 'banners';
const PRIVATE_KINDS: Kind[] = ['verification', 'evidence'];

function uploader(kind: Kind, allowed: string[]) {
  const dir = path.join(PRIVATE_KINDS.includes(kind) ? PRIVATE_ROOT : PUBLIC_ROOT, kind);
  mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, f, cb) => cb(null, `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${EXT[f.mimetype] ?? ''}`),
    }),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 6 },
    fileFilter: (_req, f, cb) => (allowed.includes(f.mimetype) ? cb(null, true) : cb(HttpError.badRequest('Only JPG, PNG, WEBP' + (allowed.includes('application/pdf') ? ' or PDF' : '') + ' files are allowed', 'BAD_FILE_TYPE'))),
  });
}

/** Multer + content sniffing. Rejects (and deletes) files whose bytes don't match their declared type. */
function guard(kind: Kind, allowed: string[], field: string, max: number): RequestHandler {
  const mw = max === 1 ? uploader(kind, allowed).single(field) : uploader(kind, allowed).array(field, max);
  return (req, res, next) =>
    mw(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(HttpError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? `File too large (max ${env.MAX_UPLOAD_MB} MB)` : err.message, 'UPLOAD_ERROR'));
      }
      if (err) return next(err);
      const files = req.file ? [req.file] : ((req.files as Express.Multer.File[] | undefined) ?? []);
      for (const f of files) {
        if (sniff(f.path) !== f.mimetype) {
          files.forEach((x) => removeFile(x.path));
          return next(HttpError.badRequest('File content does not match its type', 'BAD_FILE_TYPE'));
        }
      }
      next();
    });
}

export const upload = {
  avatar: guard('avatars', IMAGE, 'photo', 1),
  portfolio: guard('portfolio', IMAGE, 'photos', 6),
  chatImage: guard('chat', IMAGE, 'image', 1),
  banner: guard('banners', IMAGE, 'image', 1),
  verification: guard('verification', DOC, 'documents', 4),
  evidence: guard('evidence', DOC, 'evidence', 3),
};

/** Public URL for a stored public file. */
export const publicUrl = (f: Express.Multer.File) =>
  `${env.PUBLIC_URL ?? ''}/uploads/${path.relative(PUBLIC_ROOT, f.path).split(path.sep).join('/')}`;

/** Deletes a previously-stored public file given its URL (ignores external URLs). */
export function removePublic(url?: string | null) {
  const m = url?.match(/\/uploads\/(.+)$/);
  if (m) removeFile(path.join(PUBLIC_ROOT, m[1]!));
}
export function removeFile(p: string) {
  try {
    unlinkSync(p);
  } catch {
    /* already gone */
  }
}
/** Resolves a stored private path safely (no traversal outside PRIVATE_ROOT). */
export function privatePath(rel: string) {
  const p = path.resolve(PRIVATE_ROOT, rel);
  if (!p.startsWith(PRIVATE_ROOT + path.sep)) throw HttpError.forbidden();
  return p;
}
export const privateRel = (f: Express.Multer.File) => path.relative(PRIVATE_ROOT, f.path).split(path.sep).join('/');
