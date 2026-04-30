import mongoose from "mongoose";
import type { Document } from "mongoose";
import { logger } from "../lib/logger";

export interface EnrichmentJobDoc extends Document {
  propertyId: number;
  reasons: string[];
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnrichmentJobSchema = new mongoose.Schema<EnrichmentJobDoc>(
  {
    propertyId: { type: Number, required: true, index: true },
    reasons: { type: [String], default: [] },
    status: { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

// Avoid model overwrite in watch/dev mode
const modelName = "EnrichmentJob";
const EnrichmentJobModel = (mongoose.models[modelName] as mongoose.Model<EnrichmentJobDoc>) || mongoose.model<EnrichmentJobDoc>(modelName, EnrichmentJobSchema);

export async function enqueueEnrichment(propertyId: number, reasons: string[]): Promise<void> {
  try {
    await EnrichmentJobModel.create({ propertyId, reasons });
  } catch (err: any) {
    logger.error({ err }, "Failed to enqueue enrichment job");
  }
}

export async function fetchAndLockNext(): Promise<EnrichmentJobDoc | null> {
  // atomically find a pending job and mark as processing
  const job = await EnrichmentJobModel.findOneAndUpdate(
    { status: "pending" },
    { $set: { status: "processing", updatedAt: new Date() } },
    { sort: { createdAt: 1 }, new: true },
  ).lean<EnrichmentJobDoc | null>() as unknown as EnrichmentJobDoc | null;

  return job;
}

export async function markDone(jobId: string) {
  await EnrichmentJobModel.findByIdAndUpdate(jobId, { status: "done", updatedAt: new Date() }).catch(() => {});
}

export async function markFailed(jobId: string, errMsg?: string) {
  await EnrichmentJobModel.findByIdAndUpdate(jobId, {
    status: "failed",
    lastError: errMsg?.slice(0, 1000) ?? null,
    updatedAt: new Date(),
    $inc: { attempts: 1 } as any,
  } as any).catch(() => {});
}
