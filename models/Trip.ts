import mongoose, { Schema, Model } from 'mongoose';

export interface ITrip {
  _id?: string;
  userId: string;
  participantIds?: string[];
  destination: string;
  startDate: Date;
  endDate: Date;
  tripCode?: string;
  activities: Array<{
    name: string;
    location: string;
    startTime?: Date;
    endTime?: Date;
    description?: string;
    imageUrl?: string;
  }>;
  itinerary?: Array<{
    id: string;
    name: string;
    description: string;
    color: string;
    startTime: string;
    endTime: string;
    day: number;
  }>;
  status?: 'collecting_preferences' | 'ready' | 'active';
  createdAt?: Date;
  updatedAt?: Date;
}

const TripSchema = new Schema<ITrip>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    participantIds: {
      type: [String],
      default: [],
      index: true,
    },
    destination: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    tripCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    activities: [
      {
        name: {
          type: String,
          required: true,
        },
        location: {
          type: String,
          required: true,
        },
        startTime: {
          type: Date,
          required: false,
        },
        endTime: {
          type: Date,
          required: false,
        },
        description: {
          type: String,
          required: false,
        },
        imageUrl: {
          type: String,
          required: false,
        },
      },
    ],
    itinerary: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: false,
        },
        color: {
          type: String,
          required: true,
        },
        startTime: {
          type: String,
          required: true,
        },
        endTime: {
          type: String,
          required: true,
        },
        day: {
          type: Number,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ['collecting_preferences', 'ready', 'active'],
      default: 'collecting_preferences',
    },
  },
  {
    timestamps: true,
  }
);

const Trip: Model<ITrip> = mongoose.models.Trip || mongoose.model<ITrip>('Trip', TripSchema);

export default Trip;
