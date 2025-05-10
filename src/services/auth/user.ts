import { ENV } from '@/env';
import prisma from '@/libs/prisma';
import logger from '@/logger';
import { AuthenticationError, ConflictError } from '@/utils/errors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

type UserInfo = {
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
};

const auth = (user: Express.Request['user']) => {
  if (!user) {
    throw new AuthenticationError('Not authenticated');
  }
  const userInfo: UserInfo = {
    createdAt: user.created_at,
    email: user.email,
    firstName: user.firstName,

    lastName: user.lastName,

    userId: user.id,
  };
  return userInfo;
};

const registerUser = async (
  email: string,
  firstName: string,
  lastName: string,
  password: string,
) => {
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError('User already exists');
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        password: passwordHash,
      },
    });
    return {
      email: result.email,
      firstName: result.firstName,
      lastName: result.lastName,
    };
  } catch (error) {
    logger.error('Error register user', error);
    throw error;
  }
};

const loginUser = async (
  email: string,
  password: string,
  rememberMe: boolean,
) => {
  try {
    const result = await prisma.user.findUnique({
      where: { deleted_at: null, email },
    });
    if (!result) {
      throw new AuthenticationError('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, result.password);
    if (!passwordMatch) {
      throw new AuthenticationError('Password does not match');
    }

    const refershToken = rememberMe
      ? jwt.sign(
          {
            userId: result.id,
          },
          ENV.REFRESH_TOKEN_SECRET,
          { expiresIn: '30d' },
        )
      : undefined;

    const token = jwt.sign(
      {
        userId: result.id,
      },
      ENV.JWT_SECRET,
      { expiresIn: '1d' },
    );

    const userInfo: UserInfo = {
      createdAt: result.created_at,
      email: result.email,
      firstName: result.firstName,

      lastName: result.lastName,

      userId: result.id,
    };
    return { refershToken, token, userInfo };
  } catch (error) {
    logger.error('Error login user', error);
    throw error;
  }
};

export { registerUser, loginUser, auth };
