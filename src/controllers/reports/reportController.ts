import logger from '@/logger';
import * as disasterReportService from '@/services/disasterReports/disasterReports';
import { uploadToSupabase } from '@/services/disasterReports/upload';
import { DisasterIncidentParametersSchema } from '@/types/reports';
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '@/utils/errors';
import { ReportType } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { object, string, z } from 'zod';

const CreateReportSchema = object({
  name: string()
    .min(3, 'Report name is too short')
    .max(150, 'Report name is too long'),
});

const CreateReportRequestSchema = z.discriminatedUnion('reportType', [
  CreateReportSchema.extend({
    reportType: z.literal(ReportType.DISASTER_INCIDENT),
    parameters: DisasterIncidentParametersSchema,
  }),
]);

export async function CreateReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    logger.info(`got a request to create report for user: ${user.username}`);

    if (typeof req.body?.parameters === 'string') {
      try {
        req.body.parameters = JSON.parse(req.body.parameters);
      } catch (e) {
        return next(new BadRequestError('Invalid parameters JSON'));
      }
    }

    const validatedRequestBody = CreateReportRequestSchema.parse(req.body);
    const { reportType, name } = validatedRequestBody;

    let result;

    //* Switch based on report type, although currently only disaster incident is supported
    switch (reportType) {
      case ReportType.DISASTER_INCIDENT:
        // handle disaster incident report, infer type from validatedRequestBody to get the correct type
        const disasterParams = (validatedRequestBody as any)
          .parameters as z.infer<typeof DisasterIncidentParametersSchema>;

        const servicePayload: disasterReportService.ValidatedDisasterPayload = {
          reportName: name,
          description: disasterParams.description,
          incidentType: disasterParams.incidentType,
          severity: disasterParams.severity,
          incidentTimestamp: disasterParams.incidentTimestamp,
          location: {
            type: 'Point',
            coordinates: [
              disasterParams.location.longitude,
              disasterParams.location.latitude,
            ],
          },
          country: disasterParams.location.country,
          city: disasterParams.location.city,
          media: disasterParams.media || [],
        };

        if (req.file) {
          try {
            logger.info(`Uploading report image for user: ${user.id}`);
            const uploadResponse = await uploadToSupabase(req.file, user.id);

            const mediaItem = {
              type: 'IMAGE' as const,
              url: uploadResponse.url,
              caption: req.body.imageCaption || 'Report image',
            };

            servicePayload.media = [mediaItem, ...(servicePayload.media || [])];

            logger.info(
              `Successfully uploaded Report image: ${uploadResponse.url}`,
            );
          } catch (error) {
            console.error('Error uploading disaster report image:', error);
            throw new Error('Failed to upload profile image');
          }
        }

        logger.info(
          `Creating disaster report: ${JSON.stringify(servicePayload)}`,
        );
        result = await disasterReportService.createDisasterReport(
          servicePayload,
          name,
          user,
        );
        return res.status(201).json({ result });

      default:
        logger.warn(`Unknown report type: ${reportType}`);
        return next(new BadRequestError('Invalid report type'));
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    logger.error(`Error creating report: ${error}`);
    return next(error);
  }
}

export async function GetAllDiasterReports(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { cursor, limit } = req.query;
    const reports = await disasterReportService.getAllDisasterReports(
      cursor as string,
      limit as string,
    );
    return res.status(200).json({ reports });
  } catch (error) {
    logger.error(`Error fetching disaster reports: ${error}`);
    return next(error);
  }
}

export async function GetDisasterReportById(
  req: Request,
  res: Response,
  next: NextFunction,
){
  try{
    const reportId = req.params.id;

    if(!reportId){
      throw new NotFoundError('Report ID is required');
    }

    const report = await disasterReportService.getDisasterReportById(reportId);    
    return res.status(200).json({ report });
  }catch(error){
    logger.error(`Error fetching disaster report by id: ${error}`);
    return next(error);
  }
}

export async function DeleteDisasterReport(
  req: Request,
  res: Response,
  next: NextFunction,
){
  try{
    const user = req.user;
    if(!user){
      throw new AuthenticationError('User not authenticated');
    }
    const reportId = req.params.id;

    if(!reportId){
      throw new NotFoundError('Report ID is required');
    }

    const report = await disasterReportService.deleteDisasterReport(reportId, user);    
    return res.status(200).json({ report });
  }catch(error){
    logger.error(`Error deleting disaster report: ${error}`);
    return next(error);
  }
}
  