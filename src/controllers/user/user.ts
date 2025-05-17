import * as userService from '@/services/user/user';
import { NextFunction, Request, Response } from 'express';

const details = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({
        code: "INVALID_USER_ID",
        message: "User ID must be a valid number",
        status: "ERROR"
      });
    }
    
    const response = await userService.details(userId);
    return res.status(200).json(response);
  } catch (error) {
    return next(error);
  }
};

export { details };