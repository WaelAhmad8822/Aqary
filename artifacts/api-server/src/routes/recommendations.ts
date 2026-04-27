import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  cosineSimilarity,
  buildPropertyVector,
  buildUserVector,
  getMatchReasons,
  INTERACTION_WEIGHTS,
} from "../lib/cosineSimilarity";
import {
  ensureMongoConnection,
  InteractionModel,
  PropertyModel,
  UserPreferenceModel,
  toDateISOString,
} from "../lib/mongo";

const router: IRouter = Router();

router.get("/recommendations", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const userId = req.user!.userId;

  const prefs = await UserPreferenceModel.findOne({ userId }).lean();

  const properties = await PropertyModel.find({ status: "approved" }).lean();

  if (properties.length === 0) {
    res.json([]);
    return;
  }

  const interactions = await InteractionModel.find({ userId }).lean();

  const behaviorScores: Record<number, number> = {};
  for (const interaction of interactions) {
    const weight = INTERACTION_WEIGHTS[interaction.interactionType] || 1;
    const effectiveWeight = interaction.interactionType === "time_spent" && interaction.seconds
      ? weight * interaction.seconds
      : weight;
    behaviorScores[interaction.propertyId] = (behaviorScores[interaction.propertyId] || 0) + effectiveWeight;
  }

  const maxBehavior = Math.max(...Object.values(behaviorScores), 1);

  const userVector = prefs
    ? buildUserVector(
        prefs.maxBudget ?? null,
        prefs.preferredLocation ?? null,
        prefs.preferredType ?? null,
        prefs.preferredFeatures ?? [],
      )
    : buildUserVector(null, null, null, []);

  const scored = properties.map((property) => {
    const propertyVector = buildPropertyVector(
      property.price,
      property.location,
      property.propertyType,
      property.features,
    );

    const contentScore = cosineSimilarity(userVector, propertyVector);
    const normalizedBehavior = (behaviorScores[property.id] || 0) / maxBehavior;
    const finalScore = contentScore * 0.6 + normalizedBehavior * 0.4;

    const matchReasons = prefs
      ? getMatchReasons(
          { price: property.price, location: property.location, propertyType: property.propertyType, features: property.features },
          {
            maxBudget: prefs.maxBudget ?? null,
            preferredLocation: prefs.preferredLocation ?? null,
            preferredType: prefs.preferredType ?? null,
            preferredFeatures: prefs.preferredFeatures ?? [],
          },
        )
      : ["مقترح لك"];

    return {
      id: property.id,
      title: property.title,
      description: property.description,
      price: property.price,
      location: property.location,
      area: property.area,
      rooms: property.rooms,
      propertyType: property.propertyType,
      features: property.features,
      imageUrl: property.imageUrl ?? property.imageUrls?.[0] ?? null,
      imageUrls: property.imageUrls ?? (property.imageUrl ? [property.imageUrl] : []),
      sellerId: property.sellerId,
      status: property.status,
      views: property.views,
      saves: property.saves,
      contacts: property.contacts,
      createdAt: toDateISOString(property.createdAt),
      matchScore: Math.round(finalScore * 100),
      matchReasons,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  res.json(scored.slice(0, 10));
});

export default router;
