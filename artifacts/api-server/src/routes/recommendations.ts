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
  BehaviorProfileModel,
  ConversationStateModel,
  toDateISOString,
} from "../lib/mongo";

const router: IRouter = Router();

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

function similarity(a: string[], b: string[]): number {
  const A = new Set(a.map(normalize));
  const B = new Set(b.map(normalize));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

router.get("/recommendations", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const userId = req.user!.userId;

  const [prefs, behaviorProfile, latestConversation] = await Promise.all([
    UserPreferenceModel.findOne({ userId }).lean(),
    BehaviorProfileModel.findOne({ userId }).lean(),
    ConversationStateModel.findOne({ userId }).sort({ updatedAt: -1 }).lean(),
  ]);

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

  const mergedPreferences = {
    maxBudget:
      prefs?.maxBudget ??
      behaviorProfile?.maxBudget ??
      latestConversation?.slots?.budget ??
      null,
    preferredLocation:
      prefs?.preferredLocation ??
      behaviorProfile?.preferredLocation ??
      latestConversation?.slots?.location ??
      null,
    preferredType:
      prefs?.preferredType ??
      behaviorProfile?.preferredType ??
      latestConversation?.slots?.propertyType ??
      null,
    preferredFeatures:
      prefs?.preferredFeatures?.length
        ? prefs.preferredFeatures
        : behaviorProfile?.preferredFeatures?.length
          ? behaviorProfile.preferredFeatures
          : latestConversation?.slots?.features ?? [],
  };

  const userVector = mergedPreferences
    ? buildUserVector(
        mergedPreferences.maxBudget,
        mergedPreferences.preferredLocation,
        mergedPreferences.preferredType,
        mergedPreferences.preferredFeatures,
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
    const locationBoost =
      mergedPreferences.preferredLocation &&
      normalize(property.location).includes(normalize(mergedPreferences.preferredLocation))
        ? 0.2
        : 0;
    const typeBoost =
      mergedPreferences.preferredType && property.propertyType === mergedPreferences.preferredType
        ? 0.2
        : 0;
    const featureBoost = similarity(property.features, mergedPreferences.preferredFeatures) * 0.2;
    const profileBoost =
      behaviorProfile?.boostedPropertyIds?.includes(property.id) ? 0.75 : 0;

    const finalScore =
      contentScore * 0.45 +
      normalizedBehavior * 0.25 +
      locationBoost +
      typeBoost +
      featureBoost +
      profileBoost;

    const matchReasons = getMatchReasons(
      { price: property.price, location: property.location, propertyType: property.propertyType, features: property.features },
      mergedPreferences,
    );

    if (profileBoost > 0) {
      matchReasons.push("مدعوم من سلوكك السابق");
    }

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
