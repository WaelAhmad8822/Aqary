export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

const LOCATION_MAP: Record<string, number> = {
  "الإسكندرية": 1, "alexandria": 1,
  "القاهرة": 2, "cairo": 2,
  "الجيزة": 3, "giza": 3,
  "المنصورة": 4, "mansoura": 4,
  "طنطا": 5, "tanta": 5,
  "أسيوط": 6, "assiut": 6,
  "الساحل الشمالي": 7, "north coast": 7,
  "العين السخنة": 8, "ain sokhna": 8,
  "6 أكتوبر": 9, "6th october": 9,
  "التجمع الخامس": 10, "new cairo": 10,
  "المعادي": 11, "maadi": 11,
  "الشيخ زايد": 12, "sheikh zayed": 12,
};

const TYPE_MAP: Record<string, number> = {
  "apartment": 1, "شقة": 1,
  "villa": 2, "فيلا": 2,
  "commercial": 3, "تجاري": 3,
  "land": 4, "أرض": 4,
};

export function buildPropertyVector(price: number, location: string, propertyType: string, features: string[]): number[] {
  const normalizedPrice = Math.min(price / 10000000, 1);
  const locationVal = LOCATION_MAP[location.toLowerCase()] || LOCATION_MAP[location] || 0;
  const normalizedLocation = locationVal / 12;
  const typeVal = TYPE_MAP[propertyType.toLowerCase()] || TYPE_MAP[propertyType] || 0;
  const normalizedType = typeVal / 4;

  const featureSet = new Set(features.map(f => f.toLowerCase()));
  const allFeatures = ["مسبح", "حديقة", "إطلالة بحرية", "موقف سيارات", "مصعد", "أمن", "تكييف مركزي", "شرفة"];
  const featureVec = allFeatures.map(f => featureSet.has(f) ? 1 : 0);

  return [normalizedPrice, normalizedLocation, normalizedType, ...featureVec];
}

export function buildUserVector(maxBudget: number | null, preferredLocation: string | null, preferredType: string | null, preferredFeatures: string[]): number[] {
  const normalizedPrice = maxBudget ? Math.min(maxBudget / 10000000, 1) : 0.5;
  const locationVal = preferredLocation ? (LOCATION_MAP[preferredLocation.toLowerCase()] || LOCATION_MAP[preferredLocation] || 0) : 0;
  const normalizedLocation = locationVal / 12;
  const typeVal = preferredType ? (TYPE_MAP[preferredType.toLowerCase()] || TYPE_MAP[preferredType] || 0) : 0;
  const normalizedType = typeVal / 4;

  const featureSet = new Set(preferredFeatures.map(f => f.toLowerCase()));
  const allFeatures = ["مسبح", "حديقة", "إطلالة بحرية", "موقف سيارات", "مصعد", "أمن", "تكييف مركزي", "شرفة"];
  const featureVec = allFeatures.map(f => featureSet.has(f) ? 1 : 0);

  return [normalizedPrice, normalizedLocation, normalizedType, ...featureVec];
}

export function getMatchReasons(
  property: { price: number; location: string; propertyType: string; features: string[] },
  prefs: { maxBudget: number | null; preferredLocation: string | null; preferredType: string | null; preferredFeatures: string[] }
): string[] {
  const reasons: string[] = [];

  if (prefs.maxBudget && property.price <= prefs.maxBudget) {
    reasons.push("يناسب ميزانيتك");
  }
  if (prefs.maxBudget && property.price > prefs.maxBudget && property.price <= prefs.maxBudget * 1.15) {
    reasons.push("قريب من ميزانيتك");
  }
  if (prefs.preferredLocation && property.location.includes(prefs.preferredLocation)) {
    reasons.push("في موقعك المفضل");
  }
  if (prefs.preferredType && property.propertyType === prefs.preferredType) {
    reasons.push("نوع العقار المطلوب");
  }

  const prefFeatures = new Set(prefs.preferredFeatures.map(f => f.toLowerCase()));
  const matchingFeatures = property.features.filter(f => prefFeatures.has(f.toLowerCase()));
  if (matchingFeatures.length > 0) {
    reasons.push("يحتوي على مواصفات مطلوبة");
  }

  if (reasons.length === 0) {
    reasons.push("مقترح لك");
  }

  return reasons;
}

export const INTERACTION_WEIGHTS: Record<string, number> = {
  view: 1,
  save: 3,
  contact: 5,
  scroll: 0.5,
  time_spent: 0.1,
};
