import { User } from '../../models/user.js';
import { WorkerProfile } from '../../models/worker.js';
import { HttpError } from '../../lib/core.js';

type UserLean = NonNullable<Awaited<ReturnType<typeof loadUser>>>;
const loadUser = (id: string) => User.findById(id).lean();

/** Shape returned to the app for the signed-in user (matches Frontend `User`). */
export async function userDto(idOrDoc: string | UserLean) {
  const u = typeof idOrDoc === 'string' ? await loadUser(idOrDoc) : idOrDoc;
  if (!u) throw HttpError.notFound('User not found');
  const wp = await WorkerProfile.findOne({ user: u._id }, { verificationStatus: 1 }).lean();
  const workerProfileStatus = !wp ? 'none' : wp.verificationStatus === 'none' ? 'draft' : wp.verificationStatus;
  return {
    id: String(u._id), mobile: u.mobile, name: u.name, email: u.email ?? undefined, avatar: u.avatar || undefined,
    roles: u.roles, activeRole: u.activeRole, language: u.language, notif: u.notif, workerProfileStatus,
    createdAt: (u.createdAt as Date).toISOString(),
  };
}
