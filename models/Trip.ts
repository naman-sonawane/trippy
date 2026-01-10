import mongoose, { Schema, Model } from 'mongoose';

export interface ITrip {
  _id?: string;
  userId: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  activities: Array<{
    name: string;
    location: string;
    startTime?: Date;
    endTime?: Date;
    description?: string;
    imageUrl?: string;
  }>;
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
  },
  {
    timestamps: true,
  }
);

const Trip: Model<ITrip> = mongoose.models.Trip || mongoose.model<ITrip>('Trip', TripSchema);

export default Trip;
