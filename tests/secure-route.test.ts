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

  it('rejects a valid, unexpired Bearer access token belonging to a soft-deleted user', async () => {
    // The mock resolves null unconditionally, which is exactly what a
    // deleted_at:null-filtered lookup for a soft-deleted user would return.
    // That means the "rejected" assertion below would pass even against the
    // pre-fix code (which never filters on deleted_at) as long as the mock
    // returns null anyway. The discriminating assertion is the one on the
    // findUnique call args: it proves the middleware actually included
    // deleted_at: null in the where clause at this call site, not just that
    // it handled a null result correctly.
    findUnique.mockResolvedValue(null);
    const req = makeReq({
      headers: { authorization: `Bearer ${signAccessToken('user-1')}` },
    } as never);
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, makeRes(), next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Access denied');
    // Discriminating assertion: fails pre-fix because the middleware calls
    // findUnique with only { id: decoded.userId }, omitting deleted_at.
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1', deleted_at: null },
    });
  });

  it('rejects an expired cookie token plus a valid refresh cookie belonging to a soft-deleted user, and mints no new cookies', async () => {
    // Same caveat as above: with an unconditional null mock, "rejected" and
    // "no cookies minted" both hold even pre-fix, because the existing
    // !result branch already declines to mint cookies for a null lookup.
    // The discriminating assertion is the findUnique call-args check: it is
    // the only one that fails against the pre-fix code, which looks up the
    // refresh-token user by { id: decodedRefreshToken.userId } alone.
    findUnique.mockResolvedValue(null);
    const expired = jwt.sign({ userId: 'user-1' }, ENV.JWT_SECRET, {
      expiresIn: -10,
    });
    const req = makeReq({
      cookies: { token: expired, refreshToken: signRefreshToken('user-1') },
    } as never);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await secureRoute()(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('Access denied');
    expect(res.cookie).not.toHaveBeenCalled();
    // Discriminating assertion: fails pre-fix because the middleware calls
    // findUnique with only { id: decodedRefreshToken.userId }, omitting
    // deleted_at.
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1', deleted_at: null },
    });
  });
});
