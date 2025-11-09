import bcrypt from 'bcryptjs';

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(ROUNDS);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
