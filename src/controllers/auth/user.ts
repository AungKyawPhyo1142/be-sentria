import * as userService from '@/services/auth/user';
import { ValidationError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import { ZodError, boolean, object, string } from 'zod';

// schema is basically what the request body should look like
const registerUserSchema = object({
  email: string().email(),
  firstName: string(),
  lastName: string(),
  password: string().min(8),
});

const loginSchema = object({
  email: string().email(),
  password: string().min(8),
  rememberMe: boolean().default(true),
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
    const { email, firstName, lastName, password } = registerUserSchema.parse(
      req.body,
    );

    const response = await userService.registerUser(
      email,
      firstName,
      lastName,
      password,
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

export { registerUser, loginUser, auth };
