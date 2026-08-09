import { ENV } from '@/env';
import prisma from '@/libs/prisma';
import secureRoute from '@/middlewares/secure-route';
import {
  signAccessToken,
  signRefreshToken,
} from '@/services/auth/token-service';
import { AuthenticationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/prisma', () => ({
  default: { user: { findUnique: vi.fn() } },
}));
vi.mock('@/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const USER = { id: 'user-1', email: 'a@b.c' };
const findUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

const makeReq = (over: Partial<Request> = {}): Request =>
  ({ cookies: {}, headers: {}, ...over }) as unknown as Request;

const makeRes = (): Response =>
  ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response;

describe('secureRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authenticates a valid Bearer token and sets req.user', async () => {
    findUnique.mockResolvedValue(USER);
    const req = makeReq({
      headers: { authorization: `Bearer ${signAccessToken('user-1')}` },
    } as never);
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, makeRes(), next);

    expect(req.user).toEqual(USER);
    expect(next).toHaveBeenCalledWith();
  });

  it('still authenticates a valid cookie token', async () => {
    findUnique.mockResolvedValue(USER);
    const req = makeReq({
      cookies: { token: signAccessToken('user-1') },
    } as never);
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, makeRes(), next);

    expect(req.user).toEqual(USER);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an expired Bearer token with "Token expired" and no cookie writes', async () => {
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    const req = makeReq({
      headers: { authorization: `Bearer ${expired}` },
    } as never);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Token expired');
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('refreshes cookies when cookie token expired and refresh cookie is valid (bugfix)', async () => {
    findUnique.mockResolvedValue(USER);
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    const req = makeReq({
      cookies: { token: expired, refreshToken: signRefreshToken('user-1') },
    } as never);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      expect.any(String),
      expect.any(Object),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(String),
      expect.any(Object),
    );
    expect(req.user).toEqual(USER);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when no token anywhere', async () => {
    const next = vi.fn() as NextFunction;
    await secureRoute()(makeReq(), makeRes(), next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Token is required');
  });

  it('rejects an expired cookie token with no refresh cookie as "Invalid token" and clears both cookies', async () => {
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    const req = makeReq({ cookies: { token: expired } } as never);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Invalid token');
    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
  });

  it('prefers the cookie token when both cookie and Bearer are present, and never verifies the Bearer token', async () => {
    findUnique.mockResolvedValue(USER);
    const req = makeReq({
      cookies: { token: signAccessToken('user-1') },
      // Deliberately unverifiable: if precedence ever flipped to the Bearer
      // token, verifying this would throw and next() would receive an error.
      headers: { authorization: 'Bearer not-a-valid-jwt' },
    } as never);
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, makeRes(), next);

    expect(req.user).toEqual(USER);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an expired cookie token with an invalid refresh cookie as "Invalid refresh token" and clears only refreshToken', async () => {
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    const req = makeReq({
      cookies: { token: expired, refreshToken: 'not-a-valid-refresh-token' },
    } as never);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Invalid refresh token');
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
    expect(res.clearCookie).not.toHaveBeenCalledWith('token');
  });
});
