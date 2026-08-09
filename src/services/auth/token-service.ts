import { ENV } from '@/env';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
}

export const signAccessToken = (userId: string): string =>
  jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: '1d' });

export const signRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, ENV.REFRESH_TOKEN_SECRET, { expiresIn: '30d' });

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, ENV.REFRESH_TOKEN_SECRET) as TokenPayload;
