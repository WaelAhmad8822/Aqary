#!/usr/bin/env node
import "dotenv/config";
import { ensureMongoConnection, PropertyModel } from "../lib/mongo";
import { getEmbedding } from "../routes/chat";
import { enqueueEnrichment } from "../jobs/enrichmentQueue";
import { logger } from "../lib/logger";

// Migration script: add explanationCached field and compute missing embeddings
async function migrate() {
  await ensureMongoConnection();
  logger.info("Migration started: computing missing embeddings and marking explanationCached=null");

  const cursor = PropertyModel.find({}).cursor();
  for await (const doc of cursor) {
    try {
      // ensure embedding
      if (!doc.embedding || !Array.isArray(doc.embedding) || doc.embedding.length === 0) {
        const text = `${doc.title} ${doc.description || ""} ${doc.location} ${doc.propertyType} ${(doc.features || []).join(" ")} السعر ${doc.price}`;
        // call openrouter embedding via helper from chat.ts
        // note: getEmbedding is exported from chat.ts; ensure chat.ts exports it
        const emb = await getEmbedding(text);
        if (emb && emb.length) {
          await PropertyModel.updateOne({ id: doc.id }, { $set: { embedding: emb, embeddingUpdatedAt: new Date() } });
          logger.info({ id: doc.id }, "computed embedding");
        }
      }

      // ensure explanationCached field exists (set null if missing)
      if ((doc as any).explanationCached === undefined) {
        await PropertyModel.updateOne({ id: doc.id }, { $set: { explanationCached: null } });
      }

      // If property has features/reasons we can enqueue enrichment to create explanation
      const reasons = [] as string[];
      // simple heuristic: if price near median or features non-empty, add a reason to prompt LLM
      if ((doc.features || []).length) reasons.push("يحتوي بعض المميزات المطلوبة");
      if (reasons.length) await enqueueEnrichment(doc.id, reasons);
    } catch (err: any) {
      logger.warn({ err, id: doc.id }, "migration item failed");
    }
  }

  logger.info("Migration finished");
  process.exit(0);
}

migrate().catch((err) => {
  logger.error({ err }, "migration failed");
  process.exit(1);
});
