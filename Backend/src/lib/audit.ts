import type { Request } from 'express';
import { AuditLog } from '../models/ops.js';
import { logger } from './core.js';

/** Records who did what, to what, and why (SRS 13: actor, timestamp and reason for every access-affecting action). */
export async function audit(req: Request, action: string, target: { type: string; id: string; label?: string }, reason?: string, meta?: unknown) {
  try {
    await AuditLog.create({
      actor: req.admin?.sub, actorName: req.admin ? `${req.admin.name} (${req.admin.role.replace('_', ' ')})` : 'system',
      action, targetType: target.type, targetId: target.id, target: target.label ?? `${target.type}:${target.id}`, reason, meta: meta as object, ip: req.ip,
    });
  } catch (err) {
    logger.error({ err, action }, 'audit log write failed');
  }
}
