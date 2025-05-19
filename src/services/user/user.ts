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

type UserUpdateData = Partial<{
  firstName: string;
  lastName: string;
  profile_image: string | null;
  email: string;
  email_verified: boolean;
  password: string;
  verified_profile: boolean;
  birthday: Date | null;
  country: string;
}>;

const details = async (userId: number) => {
  const user = await prisma.user.findFirst({ where: { id: userId, deleted_at: null } });
  
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

const update = async ( 
  id : number, 
  updateData: UserUpdateData
  ) => {
    const user = await prisma.user.findUnique({ where: { id: id } });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );
  
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...filteredData,
        updated_at: new Date(),
      },
    });
  
    return updatedUser;
}

const softDelete = async (id: number) =>{
  const user = await prisma.user.findUnique({where: {id}});

  if(!user){
    throw new NotFoundError('User not Found');
  }

  const deletedUser = await prisma.user.update({
    where:{id},
    data:{
      deleted_at: new Date(),
      updated_at: new Date()
    }
  })

  return deletedUser;
}

const recover = async (id:number) => {
  const user = await prisma.user.findUnique({where: {id}});

  if(!user || user.deleted_at === null){
    throw new NotFoundError("User not found or already active");
  }

  const recoverUser = await prisma.user.update({
    where: {id},
    data:{
      deleted_at: null,
      updated_at: new Date(),
    }
  })

  return recoverUser;
}

export { details, update, softDelete, recover };