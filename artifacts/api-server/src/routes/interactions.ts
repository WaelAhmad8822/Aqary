import { Router, type IRouter } from "express";
import { TrackInteractionBody, TrackPageViewBody } from "@workspace/api-zod";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth";
import { INTERACTION_WEIGHTS } from "../lib/cosineSimilarity";
import {
  ensureMongoConnection,
  nextSequence,
  InteractionModel,
  PropertyModel,
  PageViewModel,
} from "../lib/mongo";

type InteractionType = "view" | "save" | "contact" | "scroll" | "time_spent";
const VALID_INTERACTION_TYPES: InteractionType[] = ["view", "save", "contact", "scroll", "time_spent"];

function isValidInteractionType(value: string): value is InteractionType {
  return VALID_INTERACTION_TYPES.includes(value as InteractionType);
}

const router: IRouter = Router();

router.post("/track", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = TrackInteractionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { propertyId, interactionType, seconds } = parsed.data;

  if (interactionType === "unsave") {
    const deleteResult = await InteractionModel.deleteMany({
      userId: req.user!.userId,
      propertyId,
      interactionType: "save",
    });
    const removed = deleteResult.deletedCount ?? 0;
    if (removed > 0) {
      const prop = await PropertyModel.findOne({ id: propertyId }).lean();
      if (prop) {
        await PropertyModel.updateOne(
          { id: propertyId },
          { $set: { saves: Math.max(0, prop.saves - removed) } },
        );
      }
    }
    res.status(200).json({ message: "تمت إزالة العقار من المحفوظات" });
    return;
  }

  if (!isValidInteractionType(interactionType)) {
    res.status(400).json({ error: "نوع التفاعل غير صالح" });
    return;
  }

  const weight = INTERACTION_WEIGHTS[interactionType] || 1;

  await InteractionModel.create({
    id: await nextSequence("interactions"),
    userId: req.user!.userId,
    propertyId,
    interactionType,
    weight,
    seconds: seconds || null,
  });

  if (interactionType === "view") {
    await PropertyModel.updateOne({ id: propertyId }, { $inc: { views: 1 } });
  } else if (interactionType === "save") {
    await PropertyModel.updateOne({ id: propertyId }, { $inc: { saves: 1 } });
  } else if (interactionType === "contact") {
    await PropertyModel.updateOne({ id: propertyId }, { $inc: { contacts: 1 } });
  }

  res.status(201).json({ message: "تم تسجيل التفاعل" });
});

router.post("/track/page-view", optionalAuthMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = TrackPageViewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawPath = parsed.data.path.trim();
  if (!rawPath.startsWith("/")) {
    res.status(400).json({ error: "المسار يجب أن يبدأ بـ /" });
    return;
  }

  await PageViewModel.create({
    id: await nextSequence("pageViews"),
    userId: req.user?.userId ?? null,
    path: rawPath.slice(0, 512),
  });

  res.status(201).json({ message: "تم تسجيل الزيارة" });
});

export default router;
