import { UserRoles, Users } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: Users & { userRoles: UserRoles[] };
    }
  }
}
