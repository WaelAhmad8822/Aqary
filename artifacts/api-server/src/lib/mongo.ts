import mongoose, { Schema, type Model } from "mongoose";
import { logger } from "./logger";

type MongooseCache = {
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  __aqaryMongoose?: MongooseCache;
};

const mongooseCache: MongooseCache =
  globalForMongoose.__aqaryMongoose ?? { promise: null };
let conversationStateIndexMigrationDone = false;

globalForMongoose.__aqaryMongoose = mongooseCache;

export async function ensureMongoConnection(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    throw new Error("MONGODB_URI (or DATABASE_URL) must be set for database access.");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || "aqary",
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        retryWrites: true,
        w: "majority",
      })
      .then(async (conn) => {
        await dropLegacyConversationStateIdIndex();
        return conn;
      })
      .catch((err) => {
        logger.error({ err }, "MongoDB connection failed, will retry on next attempt");
        mongooseCache.promise = null;
        throw err;
      });
  }

  return mongooseCache.promise;
}

async function dropLegacyConversationStateIdIndex(): Promise<void> {
  if (conversationStateIndexMigrationDone) return;

  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const collection = db.collection("conversationstates");
    const indexes = await collection.indexes();
    const hasLegacyIdIndex = indexes.some((index) => index.name === "id_1");

    if (hasLegacyIdIndex) {
      await collection.dropIndex("id_1");
      logger.info("Dropped legacy conversationstates id_1 index");
    }
  } catch (err) {
    logger.warn({ err }, "Could not drop legacy conversationstates id_1 index");
  } finally {
    conversationStateIndexMigrationDone = true;
  }
}

// ---------------------------------------------------------------------------
// Document interfaces (used by Model<T> so `.lean()` is typed correctly)
// ---------------------------------------------------------------------------

export interface ICounter {
  name: string;
  seq: number;
}

export interface IUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  role: "buyer" | "seller" | "admin";
  createdAt: Date;
}

export type PropertyType = "apartment" | "villa" | "commercial" | "land";

export interface IProperty {
  id: number;
  title: string;
  description: string;
  price: number;
  location: string;
  area: number;
  rooms: number | null;
  propertyType: PropertyType;
  features: string[];
  imageUrl: string | null;
  imageUrls: string[];
  sellerId: number;
  status: "pending" | "approved" | "rejected";
  views: number;
  saves: number;
  contacts: number;
  createdAt: Date;
}

export type InteractionType = "view" | "save" | "contact" | "scroll" | "time_spent";

export interface IInteraction {
  id: number;
  userId: number;
  propertyId: number;
  interactionType: InteractionType;
  weight: number;
  seconds: number | null;
  createdAt: Date;
}

export interface IFeedback {
  id: number;
  userId: number | null;
  message: string;
  criteria: string | null;
  resolved: boolean;
  createdAt: Date;
}

export interface IUserPreference {
  id: number;
  userId: number;
  preferredLocation: string | null;
  maxBudget: number | null;
  preferredType: string | null;
  preferredFeatures: string[];
  updatedAt: Date;
}

export interface IPageView {
  id: number;
  userId: number | null;
  path: string;
  createdAt: Date;
}

export interface IBehaviorProfile {
  userId: number;
  preferredLocation: string | null;
  maxBudget: number | null;
  preferredType: string | null;
  preferredFeatures: string[];
  boostedPropertyIds: number[];
  updatedAt: Date;
  createdAt: Date;
}

export interface IRefreshToken {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface IConversationSlots {
  role: "buyer" | "seller" | null;
  payment: "cash" | "installment" | null;
  budget: number | null;
  location: string | null;
  propertyType: string | null;
  features: string[];
}

export interface IConversationState {
  userId: number;
  sessionId: string;
  /** Backend-owned funnel step; never set by the LLM. */
  currentStep: string;
  slots: IConversationSlots;
  lastUserMessage: string;
  updatedAt: Date;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const counterSchema = new Schema<ICounter>(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

const userSchema = new Schema<IUser>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: null },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      required: true,
      default: "buyer",
    },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const propertySchema = new Schema<IProperty>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    location: { type: String, required: true },
    area: { type: Number, required: true },
    rooms: { type: Number, default: null },
    propertyType: {
      type: String,
      enum: ["apartment", "villa", "commercial", "land"],
      required: true,
    },
    features: { type: [String], required: true, default: [] },
    imageUrl: { type: String, default: null },
    imageUrls: { type: [String], required: true, default: [] },
    sellerId: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    views: { type: Number, required: true, default: 0 },
    saves: { type: Number, required: true, default: 0 },
    contacts: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const interactionSchema = new Schema<IInteraction>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    propertyId: { type: Number, required: true, index: true },
    interactionType: {
      type: String,
      enum: ["view", "save", "contact", "scroll", "time_spent"],
      required: true,
    },
    weight: { type: Number, required: true, default: 1 },
    seconds: { type: Number, default: null },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const feedbackSchema = new Schema<IFeedback>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, default: null, index: true },
    message: { type: String, required: true },
    criteria: { type: String, default: null },
    resolved: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const preferenceSchema = new Schema<IUserPreference>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, required: true, unique: true, index: true },
    preferredLocation: { type: String, default: null },
    maxBudget: { type: Number, default: null },
    preferredType: { type: String, default: null },
    preferredFeatures: { type: [String], required: true, default: [] },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const pageViewSchema = new Schema<IPageView>(
  {
    id: { type: Number, required: true, unique: true, index: true },
    userId: { type: Number, default: null, index: true },
    path: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const behaviorProfileSchema = new Schema<IBehaviorProfile>(
  {
    userId: { type: Number, required: true, unique: true, index: true },
    preferredLocation: { type: String, default: null },
    maxBudget: { type: Number, default: null },
    preferredType: { type: String, default: null },
    preferredFeatures: { type: [String], required: true, default: [] },
    boostedPropertyIds: { type: [Number], required: true, default: [] },
    updatedAt: { type: Date, required: true, default: Date.now },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Number, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null, index: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

const conversationStateSchema = new Schema<IConversationState>(
  {
    userId: { type: Number, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    currentStep: { type: String, required: true, default: "start", index: true },
    slots: {
      role: { type: String, enum: ["buyer", "seller"], default: null },
      payment: { type: String, enum: ["cash", "installment"], default: null },
      budget: { type: Number, default: null },
      location: { type: String, default: null },
      propertyType: { type: String, default: null },
      features: { type: [String], required: true, default: [] },
    },
    lastUserMessage: { type: String, default: "" },
    updatedAt: { type: Date, required: true, default: Date.now, index: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);
conversationStateSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  return existing ?? mongoose.model<T>(name, schema);
}

export const CounterModel = getModel<ICounter>("Counter", counterSchema);
export const UserModel = getModel<IUser>("User", userSchema);
export const PropertyModel = getModel<IProperty>("Property", propertySchema);
export const InteractionModel = getModel<IInteraction>("Interaction", interactionSchema);
export const FeedbackModel = getModel<IFeedback>("Feedback", feedbackSchema);
export const UserPreferenceModel = getModel<IUserPreference>("UserPreference", preferenceSchema);
export const PageViewModel = getModel<IPageView>("PageView", pageViewSchema);
export const BehaviorProfileModel = getModel<IBehaviorProfile>("BehaviorProfile", behaviorProfileSchema);
export const RefreshTokenModel = getModel<IRefreshToken>("RefreshToken", refreshTokenSchema);
export const ConversationStateModel = getModel<IConversationState>("ConversationState", conversationStateSchema);

export async function nextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean<{ seq: number }>();
  if (!counter) {
    throw new Error(`Failed to allocate sequence for '${name}'`);
  }
  return counter.seq;
}

export function toDateISOString(value: Date): string {
  return value.toISOString();
}
