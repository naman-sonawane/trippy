import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
  _id?: string;
  name?: string;
  email: string;
  image?: string;
  emailVerified?: Date;
  googleId?: string;
  age?: number;
  budget?: string;
  walk?: string;
  dayNight?: string;
  solo?: boolean;
  preferences?: {
    likedItems?: string[];
    dislikedItems?: string[];
    travelHistory?: string[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    image: {
      type: String,
      required: false,
    },
    emailVerified: {
      type: Date,
      required: false,
    },
    googleId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    age: {
      type: Number,
      required: false,
    },
    budget: {
      type: String,
      required: false,
    },
    walk: {
      type: String,
      required: false,
    },
    dayNight: {
      type: String,
      required: false,
    },
    solo: {
      type: Boolean,
      required: false,
    },
    preferences: {
      likedItems: {
        type: [String],
        default: [],
      },
      dislikedItems: {
        type: [String],
        default: [],
      },
      travelHistory: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
