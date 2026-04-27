import { Router, type IRouter } from "express";
import { UpdateUserPreferencesBody } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import {
  ensureMongoConnection,
  UserModel,
  UserPreferenceModel,
  InteractionModel,
  FeedbackModel,
  PropertyModel,
  toDateISOString,
  nextSequence,
} from "../lib/mongo";

const router: IRouter = Router();

router.get("/user/preferences", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const prefs = await UserPreferenceModel.findOne({ userId: req.user!.userId }).lean();
  if (!prefs) {
    res.json({ preferredLocation: null, maxBudget: null, preferredType: null, preferredFeatures: [] });
    return;
  }
  res.json({
    preferredLocation: prefs.preferredLocation,
    maxBudget: prefs.maxBudget,
    preferredType: prefs.preferredType,
    preferredFeatures: prefs.preferredFeatures,
  });
});

router.put("/user/preferences", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = UpdateUserPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const existing = await UserPreferenceModel.findOne({ userId }).lean();

  const updateData: Partial<{
    preferredLocation: string | null;
    maxBudget: number | null;
    preferredType: string | null;
    preferredFeatures: string[];
    updatedAt: Date;
  }> = {};
  if (parsed.data.preferredLocation !== undefined) updateData.preferredLocation = parsed.data.preferredLocation;
  if (parsed.data.maxBudget !== undefined) updateData.maxBudget = parsed.data.maxBudget;
  if (parsed.data.preferredType !== undefined) updateData.preferredType = parsed.data.preferredType;
  if (parsed.data.preferredFeatures !== undefined) updateData.preferredFeatures = parsed.data.preferredFeatures;
  updateData.updatedAt = new Date();

  if (existing) {
    await UserPreferenceModel.updateOne({ userId }, { $set: updateData });
  } else {
    await UserPreferenceModel.create({
      id: await nextSequence("userPreferences"),
      userId,
      ...updateData,
    });
  }

  const prefs = await UserPreferenceModel.findOne({ userId }).lean();
  if (!prefs) {
    res.json({ preferredLocation: null, maxBudget: null, preferredType: null, preferredFeatures: [] });
    return;
  }
  res.json({
    preferredLocation: prefs.preferredLocation ?? null,
    maxBudget: prefs.maxBudget ?? null,
    preferredType: prefs.preferredType ?? null,
    preferredFeatures: prefs.preferredFeatures ?? [],
  });
});

router.get("/user/saved", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const userId = req.user!.userId;
  const savedInteractions = await InteractionModel.find({
    userId,
    interactionType: "save",
  })
    .select({ propertyId: 1, _id: 0 })
    .lean();

  const propertyIds = [...new Set(savedInteractions.map(i => i.propertyId))];
  if (propertyIds.length === 0) {
    res.json([]);
    return;
  }

  const properties = await PropertyModel.find({ id: { $in: propertyIds } }).lean();
  res.json(properties.map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    location: p.location,
    area: p.area,
    rooms: p.rooms,
    propertyType: p.propertyType,
    features: p.features,
    imageUrl: p.imageUrl ?? p.imageUrls?.[0] ?? null,
    imageUrls: p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []),
    sellerId: p.sellerId,
    status: p.status,
    views: p.views,
    saves: p.saves,
    contacts: p.contacts,
    createdAt: toDateISOString(p.createdAt),
  })));
});

router.delete("/user/delete", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const userId = req.user!.userId;
  await InteractionModel.deleteMany({ userId });
  await FeedbackModel.deleteMany({ userId });
  await UserPreferenceModel.deleteMany({ userId });
  await UserModel.deleteOne({ id: userId });
  res.sendStatus(204);
});

export default router;
