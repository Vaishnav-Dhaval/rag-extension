import { randomBytes } from 'crypto';

export function generateRequestId(): string {
  return randomBytes(12).toString('hex');
}
