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
import { ReportType, VoteType } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { nativeEnum, object, string, z } from 'zod';

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

const voteSchema = object({
  voteType: nativeEnum(VoteType, {
    errorMap: () => ({
      message: 'Vote type muist be either UPVOTE or DOWNVOTE',
    }),
  }),
});

export async function voteOnReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const { id: reportId } = req.params;
    const { voteType } = voteSchema.parse(req.body);
    const updatedReport = await disasterReportService.castVote({
      userId: user.id,
      reportId,
      voteType,
    });
    return res.status(200).json(updatedReport);
  } catch (e) {
    if (e instanceof ValidationError) {
      return next(new BadRequestError(e.message));
    } else if (e instanceof NotFoundError) {
      return next(new NotFoundError(e.message));
    } else {
      return next(e);
    }
  }
}

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
        return next(new BadRequestError(`Invalid JSON in parameters: ${e}`));
      }
    }

    const validatedRequestBody = CreateReportRequestSchema.parse(req.body);
    const { name } = validatedRequestBody;

    // let result;

    //* Switch based on report type, although currently only disaster incident is supported
    // switch (reportType) {
    //   case ReportType.DISASTER_INCIDENT:
    // handle disaster incident report, infer type from validatedRequestBody to get the correct type
    const disasterParams = validatedRequestBody.parameters as z.infer<
      typeof DisasterIncidentParametersSchema
    >;

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

    if (req?.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        logger.info(`Uploading report image for user: ${user.id}`);
        const uploadPromises = req?.files?.map(async (file, index) => {
          const uploadResponse = await uploadToSupabase(file, user.id);
          return {
            type: 'IMAGE' as 'IMAGE' | 'VIDEO',
            url: uploadResponse.url,
            caption:
              Array.isArray(req.body.imageCaptions) &&
              typeof req.body.imageCaptions[index] === 'string'
                ? (req.body.imageCaptions[index] as string)
                : `Report image ${index + 1}`,
          };
        });

        const mediaItems = await Promise.all(uploadPromises);
        servicePayload.media = [...mediaItems, ...(servicePayload.media || [])];

        logger.info(`Successfully uploaded ${mediaItems.length} Report images`);
      } catch (error) {
        console.error('Error uploading disaster report image:', error);
        throw new Error('Failed to upload profile image');
      }
    }

    logger.info(`Creating disaster report: ${JSON.stringify(servicePayload)}`);
    const result = await disasterReportService.createDisasterReport(
      servicePayload,
      name,
      user,
    );
    return res.status(201).json({ result });

    // default:
    //   logger.warn(`Unknown report type: ${reportType}`);
    //   return next(new BadRequestError('Invalid report type'));
    // }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error creating report:', err);
    return next(err);
  }
}

export async function GetAllDiasterReports(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit =
      typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const reports = await disasterReportService.getAllDisasterReports(
      cursor,
      limit,
    );
    return res.status(200).json({ reports });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching disaster reports:', err);
    return next(err);
  }
}

export async function GetDisasterReportById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const reportId = req.params.id;

    if (!reportId) {
      throw new NotFoundError('Report ID is required');
    }

    const report = await disasterReportService.getDisasterReportById(reportId);
    return res.status(200).json({ report });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching disaster report by id:', err);
    return next(err);
  }
}

export async function DeleteDisasterReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }
    const reportId = req.params.id;

    if (!reportId) {
      throw new NotFoundError('Report ID is required');
    }

    const report = await disasterReportService.deleteDisasterReport(
      reportId,
      user,
    );
    return res.status(200).json({ report });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error deleting disaster report:', err);
    return next(err);
  }
}

export async function UpdateDisasterReport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user;
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    const mongoReportId = req.params.id;
    if (!mongoReportId) {
      throw new NotFoundError('Report MongoDB ID is required');
    }

    const validationResult = CreateReportRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(validationResult.error.issues);
    }

    const { name: reportName, parameters } = validationResult.data;

    let mediaItems: Array<{
      type: 'IMAGE' | 'VIDEO';
      url: string;
      caption?: string;
    }> = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(async (file, index) => {
          const uploadResult = await uploadToSupabase(file, user.id);
          return {
            type: 'IMAGE' as 'IMAGE' | 'VIDEO',
            url: uploadResult.url,
            caption:
              Array.isArray(req.body.imageCaptions) &&
              typeof req.body.imageCaptions[index] === 'string'
                ? (req.body.imageCaptions[index] as string)
                : `Report image ${index + 1}`,
          };
        });
        mediaItems = await Promise.all(uploadPromises);
      } catch (uploadError) {
        logger.error(`Error uploading file: ${uploadError}`);
        throw new BadRequestError('Failed to upload file');
      }
    }

    const payload = {
      reportName: reportName,
      description: parameters.description,
      incidentType: parameters.incidentType,
      severity: parameters.severity,
      incidentTimestamp: parameters.incidentTimestamp,
      location: {
        type: 'Point' as const,
        coordinates: [
          parameters.location.longitude,
          parameters.location.latitude,
        ] as [number, number],
      },
      country: parameters.location.country,
      city: parameters.location.city,
      media: mediaItems,
    };

    const result = await disasterReportService.updateDisasterReport(
      mongoReportId,
      payload,
      reportName,
      user,
    );

    return res.status(200).json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError(error.issues));
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error updating disaster report:', err);
    return next(err);
  }
}
