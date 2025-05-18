import { Document, ObjectId } from 'mongodb';

export interface ValidatedDisasterPayload {
  title: string;
  description: string;
  incidentType: 'EARTHQUAKE' | 'FLOOD' | 'FIRE' | 'STORM' | 'OTHER';
  severity: 'UNKNOWN' | 'MINOR' | 'MODERATE' | 'SEVERE';
  incidentTimestamp: Date;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: {
    street?: string;
    district?: string;
    city?: string;
    country?: string;
    fullAddress?: string;
  };
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
}

// type for MongoDB document
// type-safety when accessing from MongoDB
export interface DisasterIncidentDocument extends Document {
  _id: ObjectId;
  postgresReportId: string;
  reporterUserId: number;
  title: string;
  description: string;
  incidentType: string;
  severity: string;
  incidentTimestamp: Date;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  address?: {
    street?: string;
    district?: string;
    city: string;
    country: string;
    fullAddress?: string;
  };
  media: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; caption?: string }>;
  factCheck: {
    communityScore: { upvotes: number; downvotes: number };
    goService: {
      status: string;
      confidenceScore: number | null;
      lastCheckedAt: Date | null;
    };
    overallPercentage: number;
    lastCalculatedAt: Date;
  };
  reportTimestamp: Date;
  systemCreatedAt: Date;
  systemUpdatedAt: Date;
}
