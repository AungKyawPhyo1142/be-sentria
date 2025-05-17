import prisma from '@/libs/prisma';
import { NotFoundError } from '@/utils/errors';

type UserDetails = {
  id: number;
  firstName: string;
  lastName: string;
  profile_image: string | null;
  email: string;
  password: string;
  email_verified: boolean;
  email_verified_at: Date | null;
  verified_profile: boolean;
  birthday: Date | null;
  country: string;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
};

const details = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  const userInfo: UserDetails = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profile_image: user.profile_image || null,
    email: user.email,
    password: user.password,
    email_verified: user.email_verified || false,
    email_verified_at: user.email_verified_at || null,
    verified_profile: user.verified_profile || false,
    birthday: user.birthday || null,
    country: user.country,
    created_at: user.created_at,
    updated_at: user.updated_at || null,
    deleted_at: user.deleted_at || null,
  };
  
  return userInfo;
};

export { details };