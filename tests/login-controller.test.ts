import * as userController from '@/controllers/auth/user';
import * as userService from '@/services/auth/user';
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/auth/user', () => ({
  loginUser: vi.fn(),
}));
vi.mock('@/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const USER_INFO = {
  createdAt: new Date('2026-01-01'),
  email: 'a@b.co',
  firstName: 'Aung',
  username: 'aung',
  lastName: 'K',
  userId: 'user-1',
};

const makeRes = (): Response =>
  ({
    cookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const body = { email: 'a@b.co', password: 'password123', rememberMe: true };

describe('loginUser controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (userService.loginUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      refershToken: 'refresh-abc',
      token: 'access-abc',
      userInfo: USER_INFO,
    });
  });

  it('includes tokens in the body for X-Client: mobile', async () => {
    const req = {
      body,
      headers: { 'x-client': 'mobile' },
    } as unknown as Request;
    const res = makeRes();

    await userController.loginUser(req, res, vi.fn() as NextFunction);

    expect(res.json).toHaveBeenCalledWith({
      ...USER_INFO,
      token: 'access-abc',
      refreshToken: 'refresh-abc',
    });
  });

  it('keeps the web response unchanged (no tokens in body)', async () => {
    const req = { body, headers: {} } as unknown as Request;
    const res = makeRes();

    await userController.loginUser(req, res, vi.fn() as NextFunction);

    expect(res.json).toHaveBeenCalledWith(USER_INFO);
    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      'access-abc',
      expect.any(Object),
    );
  });
});
