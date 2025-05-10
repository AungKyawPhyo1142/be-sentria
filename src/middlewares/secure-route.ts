import { ENV } from '@/env';
import prisma from '@/libs/prisma';
import logger from '@/logger';
import { AuthenticationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';

interface JwtPayload {
  userId: number;
}

const secureRoute = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;

    if (!token) {
      return next(new AuthenticationError('Token is required'));
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
      const result = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!result) {
        return next(new AuthenticationError('Access denied'));
      }
      req.user = result;
      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError && refreshToken) {
        try {
          const decodedRefreshToken = jwt.verify(
            refreshToken,
            ENV.JWT_SECRET,
          ) as Pick<JwtPayload, 'userId'>;
          const result = await prisma.user.findUnique({
            where: { id: decodedRefreshToken.userId },
          });
          if (!result) {
            return next(new AuthenticationError('Access denied'));
          }

          const newRefreshToken = jwt.sign(
            {
              userId: result.id,
            },
            ENV.REFRESH_TOKEN_SECRET,
            { expiresIn: '30d' },
          );

          const newToken = jwt.sign({ userId: result.id }, ENV.JWT_SECRET, {
            expiresIn: '1d',
          });

          res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
          });

          res.cookie('token', newToken, {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
          });
          req.user = result;
          return next();
        } catch (refreshError) {
          res.clearCookie('refreshToken');
          logger.error('Error verifying refresh token', refreshError);
          return next(new AuthenticationError('Invalid refresh token'));
        }
      } else {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        logger.error('Error authenticating user:', error);
        return next(new AuthenticationError('Invalid token'));
      }
    }
  };
};

export default secureRoute;
