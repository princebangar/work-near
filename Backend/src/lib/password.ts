import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Salted bcrypt hash; cost comes from BCRYPT_SALT_ROUNDS (min 10). Existing hashes keep their own cost and still verify. */
export const hashPassword = (p: string) => bcrypt.hash(p, env.BCRYPT_SALT_ROUNDS);

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
// (response time must not reveal which admin emails are registered).
const DUMMY_HASH = bcrypt.hashSync('worknear-timing-equaliser', env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = (p: string, hash?: string | null) => bcrypt.compare(p, hash || DUMMY_HASH).then((ok) => ok && !!hash);
