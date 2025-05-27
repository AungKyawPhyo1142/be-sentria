import { ENV } from '@/env';
import { sendEmail } from '@/helpers/sendEmail';
import prisma from '@/libs/prisma';
import logger from '@/logger';
import {
  AuthenticationError,
  ConflictError,
  EmailValidationError,
  NotFoundError,
} from '@/utils/errors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

type UserInfo = {
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
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
    username: user.username,
    lastName: user.lastName,
    userId: user.id,
  };
  return userInfo;
};

const registerUser = async (
  email: string,
  firstName: string,
  lastName: string,
  username: string,
  birthday: string,
  password: string,
  country: string,
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
        username,
        birthday: new Date(birthday),
        country,
        password: passwordHash,
      },
    });

    // generate verification token
    const emailVerificationToken = jwt.sign(
      { userId: result.id },
      ENV.JWT_SECRET,
      { expiresIn: `24hr` },
    );

    const verifcationURL = `${ENV.FRONTEND_URL}/auth/verify-email/${emailVerificationToken}`;

    // this is the data that will be sent to the email template
    const data = {
      name: `${firstName} ${lastName}`,
      email: email,
      verificationLink: verifcationURL,
      currentYear: new Date().getFullYear(),
    };

    // send verification email here
    await sendEmail(
      'email_verification_template_v1',
      'email_verification',
      [email],
      'Sentria - Email Verification',
      data,
    );

    return {
      email: result.email,
      firstName: result.firstName,
      lastName: result.lastName,
      username: result.username,
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
      username: result.username,
      lastName: result.lastName,
      userId: result.id,
    };
    return { refershToken, token, userInfo };
  } catch (error) {
    logger.error('Error login user', error);
    throw error;
  }
};

const verifyEmail = async (token: string) => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      throw new AuthenticationError('Invalid token');
    }

    if (user.email_verified) {
      return {
        message: 'Email already verified',
      };
    }

    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        email_verified: true,
        email_verified_at: new Date(),
      },
    });

    return {
      message: 'Email verified successfully',
    };
  } catch (error) {
    logger.error('Error verify email', error);
    throw new EmailValidationError('There was an error with email verification');
  }
};

const resendEmail = async (email: string) => {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.email_verified) {
      return {
        message: 'Email already verified',
      };
    }

    const verificationToken = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, {
      expiresIn: '24hr',
    });

    const verifcationURL = `${ENV.FRONTEND_URL}/auth/verify-email/${verificationToken}`;

    // this is the data that will be sent to the email template
    const data = {
      name: `${user.firstName} ${user.lastName}`,
      email: email,
      verificationLink: verifcationURL,
      currentYear: new Date().getFullYear(),
    };

    // send verification email here
    await sendEmail(
      'email_verification_template_v1',
      'email_verification',
      [email],
      'Sentria - Email Verification',
      data,
    );
    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    };
  } catch (error) {
    logger.error('Error resend email', error);
    throw new EmailValidationError('There was an error with email verification');
  }
};

export { registerUser, loginUser, auth, verifyEmail, resendEmail };
