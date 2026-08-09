import { ENV } from '@/env';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/services/auth/token-service';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

describe('token-service', () => {
  it('round-trips an access token', () => {
    const token = signAccessToken('user-1');
    expect(verifyAccessToken(token)).toMatchObject({ userId: 'user-1' });
  });

  it('round-trips a refresh token', () => {
    const token = signRefreshToken('user-1');
    expect(verifyRefreshToken(token)).toMatchObject({ userId: 'user-1' });
  });

  it('rejects a refresh token passed as an access token (different secrets)', () => {
    const refresh = signRefreshToken('user-1');
    expect(() => verifyAccessToken(refresh)).toThrow();
  });

  it('rejects an access token passed as a refresh token', () => {
    const access = signAccessToken('user-1');
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('throws TokenExpiredError for an expired access token', () => {
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(expired)).toThrow(TokenExpiredError);
  });
});
