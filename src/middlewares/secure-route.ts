// import { ENV } from '@/env';
// import prisma from '@/libs/prisma';
// import logger from '@/logger';
// import { AuthenticationError, UnauthorizedError } from '@/utils/errors';
// import { NextFunction, Request, Response } from 'express';
// import jwt, { TokenExpiredError } from 'jsonwebtoken';

// interface JwtPayload {
//   userId: number;
//   userRoles: number[];
// }

// const secureRoute = (allowedRoles: number[] = []) => {
//   return async (req: Request, res: Response, next: NextFunction) => {
//     const token = req.cookies.token;
//     const refreshToken = req.cookies.refreshToken;
//     if (!token) {
//       return next(new AuthenticationError('Token is required.'));
//     }
//     try {
//       const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
//       const result = await prisma.users.findUnique({
//         include: { userRoles: true },
//         where: { userId: decoded.userId },
//       });
//       if (!result || result.deactivated) {
//         return next(new UnauthorizedError('Access denied.'));
//       } else if (allowedRoles.length === 0) {
//         req.user = result;
//         return next();
//       }
//       const resultRoles = result?.userRoles.map((role) => role.roleId);
//       if (allowedRoles.some((checkRole) => resultRoles?.includes(checkRole))) {
//         req.user = result;
//         return next();
//       } else {
//         return next(new UnauthorizedError('Insufficient role.'));
//       }
//     } catch (error) {
//       if (error instanceof TokenExpiredError && refreshToken) {
//         try {
//           const decodedRefreshToken = jwt.verify(
//             refreshToken,
//             ENV.REFRESH_TOKEN_SECRET,
//           ) as Pick<JwtPayload, 'userId'>;
//           const result = await prisma.users.findUnique({
//             include: { userRoles: true },
//             where: { userId: decodedRefreshToken.userId },
//           });
//           if (!result || result.deactivated) {
//             return next(new UnauthorizedError('Access denied.'));
//           }
//           const newRefreshToken = jwt.sign(
//             {
//               userId: result.userId,
//             },
//             ENV.REFRESH_TOKEN_SECRET,
//             { expiresIn: '30d' },
//           );
//           const newToken = jwt.sign(
//             {
//               userId: result.userId,
//               userRoles: result.userRoles.map((role) => role.roleId),
//             },
//             ENV.JWT_SECRET,
//             { expiresIn: '1d' },
//           );
//           res.cookie('refreshToken', newRefreshToken, {
//             httpOnly: true,
//             sameSite: 'none',
//             secure: true,
//           });
//           res.cookie('token', newToken, {
//             httpOnly: true,
//             sameSite: 'none',
//             secure: true,
//           });
//           req.user = result;
//           return next();
//         } catch (refreshError) {
//           res.clearCookie('refreshToken');
//           logger.error('Error authenticating refresh token:', refreshError);
//           return next(new AuthenticationError('Invalid refresh token.'));
//         }
//       } else {
//         res.clearCookie('token');
//         res.clearCookie('refreshToken');
//         logger.error('Error authenticating user:', error);
//         return next(new AuthenticationError('Invalid token.'));
//       }
//     }
//   };
// };

// export default secureRoute;
