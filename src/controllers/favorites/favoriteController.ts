import logger from '@/logger';
import { NextFunction, Request, Response } from 'express';

export async function CreateFavorite(
    _req: Request,
    _res: Response,
    next: NextFunction
){
    try{

    }catch(error){
        logger.error(`Error creating favourite: ${error}`)
        return next(error);
    }
}