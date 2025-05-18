import logger from '@/logger';
import * as disasterReportService from '@/services/disasterReports/disasterReports';
import { ValidatedDisasterPayload } from '@/types/disasterReports';
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

// for disaster (parameters part of the request)
const DisasterIncidentParametersSchema = object({
  title: string()
    .min(3, 'Report title is too short')
    .max(150, 'Report title is too long'),
  description: string().min(10, 'Report description is too short').max(5000),
  incidentType: z.enum(['EARTHQUAKE', 'FLOOD', 'FIRE', 'STORM', 'OTHER'], {
    required_error: 'Incident type is required',
    invalid_type_error: 'Invalid incident type',
  }),
  severity: z.enum(['UNKNOWN', 'MINOR', 'MODERATE', 'SEVERE'], {
    required_error: 'Severity is required',
    invalid_type_error: 'Invalid severity',
  }),
  incidentTimestamp: string()
    .datetime({ message: 'Invalid date format, should be ISO 8601' })
    .transform((val) => new Date(val)),
  location: object({
    city: string().min(1, 'City is required'),
    country: string().min(1, 'Country is required'),
    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
  }),
  address: object({
    street: string().optional(),
    district: string().optional(),
    fullAddress: string().optional(),
  }).optional(),
  media: z
    .array(
      object({
        type: z.enum(['IMAGE', 'VIDEO']),
        url: string().url({ message: 'Invalid URL' }),
        caption: string().max(250).optional(),
      }),
    )
    .max(5, 'Maximum 5 media items allowed')
    .optional()
    .default([]),
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

    const validatedRequestBody = CreateReportRequestSchema.parse(req.body);
    const { reportType, name } = validatedRequestBody;

    let result;

    switch (reportType) {
      case ReportType.DISASTER_INCIDENT:
        // handle disaster incident report, infer type from validatedRequestBody to get the correct type
        const disasterParams = (validatedRequestBody as any)
          .parameters as z.infer<typeof DisasterIncidentParametersSchema>;

        const servicePayload: ValidatedDisasterPayload = {
          title: disasterParams.title,
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
          // construct address object for MongoDB
          address: {
            street: disasterParams.address?.street,
            district: disasterParams.address?.district,
            city: disasterParams.location.city,
            country: disasterParams.location.country,
            fullAddress: disasterParams.address?.fullAddress,
          },
          media: disasterParams.media || [],
        };
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

// we will only return disaster report for now, later we may add other types if needed
export async function getDisasterReportById(req: Request, res: Response, next: NextFunction) {
  try {

    // const user = req.user
    const { reportId } = req.params

    if (!reportId) {
      return next(new BadRequestError('Report ID is required'))
    }

    const fullDisasterReportData = await disasterReportService.getFullDisasterReportById(reportId)

    if (fullDisasterReportData.reportType !== ReportType.DISASTER_INCIDENT && !fullDisasterReportData.details) {
      logger.warn(`Controller: Disaster report ${reportId} details not found in MongoDB, PG metadata found`)
      return next(new NotFoundError(`Desaster report ${reportId} not found`))
    }

    return res.status(200).json({
      report: fullDisasterReportData
    })

  } catch (error) {
    logger.error(`Error getting disaster report by id: ${error}`)
    return next(error)
  }
}