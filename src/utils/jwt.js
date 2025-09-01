import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export function signAuthToken(payload = {}) {
  const jti = uuidv4();
  const token = jwt.sign({ ...payload }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    jwtid: jti,
  });
  return { token, jti };
}

export function verifyAuthToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
