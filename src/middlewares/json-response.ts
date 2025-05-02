import { NextFunction, Request, Response } from 'express';

interface StandardResponse<T> {
  status: string;
  data: T;
}

const jsonResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  res.json = function <T>(body: T): Response {
    if (res.locals.isErrorResponse) {
      return originalJson.call(this, body);
    }
    const wrappedBody: StandardResponse<T> = {
      data: body,
      status: 'SUCCESS',
    };
    return originalJson.call(this, wrappedBody);
  };
  return next();
};

export default jsonResponse;
