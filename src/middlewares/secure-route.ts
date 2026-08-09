import prisma from '@/libs/prisma';
import logger from '@/logger';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/services/auth/token-service';
import { AuthenticationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
} as const;

const getBearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : undefined;
};

const secureRoute = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cookieToken = req.cookies.token as string | undefined;
    const bearerToken = getBearerToken(req);
    const token = cookieToken ?? bearerToken;
    const isBearer = !cookieToken && !!bearerToken;
    const refreshToken = req.cookies.refreshToken as string | undefined;

    if (!token) {
      return next(new AuthenticationError('Token is required'));
    }

    try {
      const decoded = verifyAccessToken(token);
      const result = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!result) {
        return next(new AuthenticationError('Access denied'));
      }
      req.user = result;
      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError && isBearer) {
        // Bearer clients hold their own refresh token; they must call POST /auth/refresh.
        return next(new AuthenticationError('Token expired'));
      }
      if (error instanceof TokenExpiredError && refreshToken) {
        try {
          const decodedRefreshToken = verifyRefreshToken(refreshToken);
          const result = await prisma.user.findUnique({
            where: { id: decodedRefreshToken.userId },
          });
          if (!result) {
            return next(new AuthenticationError('Access denied'));
          }

          res.cookie(
            'refreshToken',
            signRefreshToken(result.id),
            COOKIE_OPTIONS,
          );
          res.cookie('token', signAccessToken(result.id), COOKIE_OPTIONS);
          req.user = result;
          return next();
        } catch (refreshError) {
          res.clearCookie('refreshToken');
          logger.error('Error verifying refresh token', refreshError);
          return next(new AuthenticationError('Invalid refresh token'));
        }
      }
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      logger.error('Error authenticating user:', error);
      return next(new AuthenticationError('Invalid token'));
    }
  };
};

export default secureRoute;
