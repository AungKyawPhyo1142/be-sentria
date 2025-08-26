import logger from '@/logger';
import * as userService from '@/services/auth/user';
import { AuthenticationError, ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { ZodError, boolean, object, string } from 'zod';

// schema is basically what the request body should look like
const registerUserSchema = object({
  email: string().email(),
  firstName: string(),
  lastName: string(),
  password: string().min(8),
  username: string(),
  birthday: string(),
  country: string(),
});

const forgotPasswordSchema = object({
  email: string().email(),
});

const loginSchema = object({
  email: string().email(),
  password: string().min(8),
  rememberMe: boolean().default(true),
});

const resendEmailSchema = object({
  email: string().email(),
});

const resetPasswordSchema = object({
  password: string().min(8),
});

const auth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = userService.auth(req.user);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      email,
      firstName,
      lastName,
      password,
      username,
      country,
      birthday,
    } = registerUserSchema.parse(req.body);

    const response = await userService.registerUser(
      email,
      firstName,
      lastName,
      username,
      birthday,
      password,
      country,
    );
    return res.status(201).json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(error);
    }
  }
};

const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body);

    const { refershToken, token, userInfo } = await userService.loginUser(
      email,
      password,
      rememberMe,
    );
    if (refershToken) {
      res.cookie('refreshToken', refershToken, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });
    }
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    return res.status(200).json(userInfo);
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    } else {
      return next(error);
    }
  }
};

const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    await userService.verifyEmail(token);
    return res.status(200).json({ message: 'Email verified' });
  } catch (error) {
    return next(error);
  }
};

const resendEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = resendEmailSchema.parse(req.body);
    await userService.resendEmail(email);
    return res.status(200).json({ message: 'Email sent' });
  } catch (error) {
    return next(error);
  }
};

const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await userService.forgotPassword(email);
    return res
      .status(200)
      .json({ message: 'forgot password email sent successfully' });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    }
    return next(error);
  }
};

const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.params;
    const { password } = resetPasswordSchema.parse(req.body);

    if (!token) {
      throw new AuthenticationError('Invalid token');
    }

    await userService.resetPassword(token, password);
    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error reset password', error);
    if (error instanceof ZodError) {
      return next(new ValidationError(error.issues));
    }
    return next(error);
  }
};

export {
  registerUser,
  loginUser,
  auth,
  verifyEmail,
  resendEmail,
  forgotPassword,
  resetPassword,
};
