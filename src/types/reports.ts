import { z } from 'zod';

type DISASTER_INCIDENT_TYPE =
  | 'EARTHQUAKE'
  | 'FLOOD'
  | 'FIRE'
  | 'STORM'
  | 'OTHER';
type DISASTER_SEVERITY = 'UNKNOWN' | 'MINOR' | 'MODERATE' | 'SEVERE';

// this is for the job to be dispatched to GO service
interface DisasterReportJobPayload {
  reportName: string;
  postgresReportId: string;
  mongoDbDocId: string;
  incidentType: string;
  description: string;
  severity: string;
  incidentTimestamp: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
  reporterUserId: number;
}

// for disaster (parameters part of the request)
const DisasterIncidentParametersSchema = z.object({
  description: z.string().min(10, 'Report description is too short').max(5000),
  incidentType: z.enum(['EARTHQUAKE', 'FLOOD', 'FIRE', 'STORM', 'OTHER'], {
    required_error: 'Incident type is required',
    invalid_type_error: 'Invalid incident type',
  }),
  severity: z.enum(['UNKNOWN', 'MINOR', 'MODERATE', 'SEVERE'], {
    required_error: 'Severity is required',
    invalid_type_error: 'Invalid severity',
  }),
  incidentTimestamp: z
    .string()
    .datetime({ message: 'Invalid date format, should be ISO 8601' })
    .transform((val) => new Date(val)), //* 2025-03-28T10:00:00Z
  location: z.object({
    city: z.string().min(1, 'City is required'),
    country: z.string().min(1, 'Country is required'),
    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
  }),
  media: z
    .array(
      z.object({
        type: z.enum(['IMAGE', 'VIDEO']),
        url: z.string().url({ message: 'Invalid URL' }),
        caption: z.string().max(250).optional(),
      }),
    )
    .max(5, 'Maximum 5 media items allowed')
    .optional()
    .default([]),
});

const now = new Date();

const MongoDBReportSchema = DisasterIncidentParametersSchema.extend({
  postgresReportId: z.string(),
  reporterUserId: z.number(),
  reportName: z.string().min(3, 'Report name is too short'),
  factCheck: z.object({
    communityScore: z.object({
      upvotes: z.number().default(0),
      downvotes: z.number().default(0),
    }),
    goService: z.object({
      status: z
        .enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'])
        .default('PENDING_VERIFICATION'),
      confidenceScore: z.number().nullable().default(null),
      lastCheckedAt: z.date().nullable().default(null),
    }),
    overallPercentage: z.number().default(0),
    lastCalculatedAt: z.date().default(now),
  }),
  createdAt: z.date().default(now),
  updatedAt: z.date().default(now),
});

export {
  DisasterReportJobPayload,
  DISASTER_INCIDENT_TYPE,
  DISASTER_SEVERITY,
  MongoDBReportSchema,
  DisasterIncidentParametersSchema,
};
