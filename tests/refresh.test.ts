import prisma from '@/libs/prisma';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/services/auth/token-service';
import { refreshUserToken } from '@/services/auth/user';
import { AuthenticationError } from '@/utils/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}));
vi.mock('@/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const findUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

describe('refreshUserToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a rotated token pair for a valid refresh token', async () => {
    findUnique.mockResolvedValue({ id: 'user-1' });
    const result = await refreshUserToken(signRefreshToken('user-1'));

    expect(verifyAccessToken(result.token)).toMatchObject({ userId: 'user-1' });
    expect(verifyRefreshToken(result.refreshToken)).toMatchObject({
      userId: 'user-1',
    });
  });

  it('rejects an access token used as refresh token', async () => {
    await expect(
      refreshUserToken(signAccessToken('user-1')),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects when the user no longer exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      refreshUserToken(signRefreshToken('ghost')),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
