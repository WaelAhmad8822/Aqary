import "dotenv/config";
import path from "path";
import { setTimeout as wait } from "timers/promises";
import { ensureMongoConnection, PropertyModel } from "../lib/mongo";
import { fetchAndLockNext, markDone, markFailed } from "../jobs/enrichmentQueue";
import { logger } from "../lib/logger";
import type { IProperty } from "../lib/mongo";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY!, baseURL: "https://openrouter.ai/api/v1" });
const OPENROUTER_CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-oss-20b";

async function callLLM(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  try {
    const res = await openai.chat.completions.create({ model: OPENROUTER_CHAT_MODEL, messages, temperature: 0.2 });
    return res.choices[0]?.message?.content || "";
  } catch (err) {
    logger.error({ err }, "worker: LLM request failed");
    return "";
  }
}

function buildPrompt(property: IProperty, reasons: string[]) {
  return `\nأنت مساعد عقاري عربي.\nاكتب سبب ترشيح هذا العقار في سطرين كحد أقصى.\nلا تخترع معلومات. استخدم فقط الأسباب التالية:\n\n${reasons.map((r) => `- ${r}`).join("\n")}\n\nالعقار:\n${property.title} - ${property.location} - ${property.price}\n`;
}

async function processJob(job: any) {
  try {
    const property = await PropertyModel.findOne({ id: job.propertyId }).lean<IProperty | null>();
    if (!property) {
      await markFailed(job._id, "property not found");
      return;
    }

    const prompt = buildPrompt(property, job.reasons || []);
    const llmExp = await callLLM([{ role: "system", content: prompt }, { role: "user", content: "اكتب التفسير." }]);

    if (llmExp) {
      await PropertyModel.updateOne({ id: property.id }, { $set: { explanationCached: llmExp } }).catch(() => {});
    }

    await markDone(job._id);
  } catch (err: any) {
    logger.error({ err, job }, "worker: failed to process job");
    await markFailed(job._id, String(err.message || err));
  }
}

async function runWorkerLoop() {
  await ensureMongoConnection();
  logger.info("Enrichment worker started");

  while (true) {
    try {
      const job = await fetchAndLockNext();
      if (!job) {
        // no job, sleep
        await wait(2000);
        continue;
      }

      await processJob(job);
    } catch (err) {
      logger.error({ err }, "worker loop error, sleeping");
      await wait(2000);
    }
  }
}

if (require.main === module) {
  runWorkerLoop().catch((err) => {
    logger.error({ err }, "worker fatal");
    process.exit(1);
  });
}

export { runWorkerLoop };
