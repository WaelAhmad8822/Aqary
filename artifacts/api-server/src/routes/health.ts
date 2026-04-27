import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { ensureMongoConnection } from "../lib/mongo";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Health check endpoint - validates API is running.
 * Tests MongoDB connection to help debug Vercel deployment issues.
 */
router.get("/healthz", async (_req, res) => {
  try {
    // Test MongoDB connection
    await ensureMongoConnection();
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json({ ...data, db: "connected" });
  } catch (error) {
    logger.error({ error }, "Health check failed - MongoDB connection error");
    res.status(503).json({
      status: "error",
      db: "disconnected",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;