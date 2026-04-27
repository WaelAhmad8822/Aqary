import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { SendChatMessageBody } from "@workspace/api-zod";
import { authMiddleware } from "../middlewares/auth";
import { logger } from "../lib/logger";
import type { IProperty } from "../lib/mongo";
import {
  ensureMongoConnection,
  PropertyModel,
  ConversationStateModel,
  BehaviorProfileModel,
  InteractionModel,
  UserPreferenceModel,
  FeedbackModel,
  nextSequence,
} from "../lib/mongo";

const router: IRouter = Router();

/* ================== OpenRouter ================== */

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

const OPENROUTER_CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL || "openai/gpt-oss-20b";
const OPENROUTER_EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL || "openai/text-embedding-3-small";
const MONGODB_VECTOR_INDEX = process.env.MONGODB_VECTOR_INDEX || ""; // Atlas vector index name
const ENABLE_ATLAS_VECTOR_SEARCH = (process.env.ENABLE_ATLAS_VECTOR_SEARCH || "true") === "true";
const MAX_RESULTS = Number(process.env.CHAT_RESULTS_LIMIT || 5);
const CANDIDATE_LIMIT = Number(process.env.CHAT_CANDIDATE_LIMIT || 30);

async function callLLM(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  try {
    const res = await openai.chat.completions.create({
      model: OPENROUTER_CHAT_MODEL,
      messages,
      temperature: 0.2,
    });

    return res.choices[0]?.message?.content || "";
  } catch (err) {
    logger.error({ err }, "LLM request failed");
    return "";
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await openai.embeddings.create({
      model: OPENROUTER_EMBED_MODEL,
      input: text,
      dimensions: 1536,
    });

    return res.data[0]?.embedding || [];
  } catch (err) {
    logger.error({ err }, "Embedding request failed");
    return [];
  }
}

/* ================== Types ================== */

type PropertyType = "apartment" | "villa" | "commercial" | "land";
type ChatRole = "user" | "assistant";
type SearchProperty = IProperty & {
  embedding?: number[];
  embeddingTextHash?: string | null;
  embeddingUpdatedAt?: Date;
};

interface ConversationSlots {
  role: "buyer" | "seller" | null;
  payment: "cash" | "installment" | null;
  budget: number | null;
  location: string | null;
  propertyType: PropertyType | null;
  features: string[];
}

interface ExtractedChatJson {
  role: "buyer" | "seller" | null;
  payment: "cash" | "installment" | null;
  budget: number | null;
  location: string | null;
  propertyType: PropertyType | null;
  features: string[];
  isComplaint: boolean;
  complaintSummary: string | null;
}

interface SearchResult {
  id: number;
  title: string;
  price: number;
  location: string;
  propertyType: string;
  propertyUrl: string;
  score: number;
  explanation: string;
  matchReasons: string[];
}

interface ConversationStateDoc {
  userId: number;
  sessionId: string;
  slots?: Partial<ConversationSlots>;
  currentStep?: string;
  lastUserMessage?: string;
}

interface UserPreferenceDoc {
  userId: number;
  preferredLocation: string | null;
  maxBudget: number | null;
  preferredType: string | null;
  preferredFeatures: string[];
}

interface BehaviorProfileDoc {
  userId: number;
  preferredLocation: string | null;
  maxBudget: number | null;
  preferredType: string | null;
  preferredFeatures: string[];
  boostedPropertyIds: number[];
}

/* ================== Helpers ================== */

function stripJsonFromText(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function safeJsonParse<T>(raw: string): T | null {
  const cleaned = stripJsonFromText(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLocationRegex(location: string): RegExp {
  return new RegExp(escapeRegex(normalize(location)), "i");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

function similarity(a: string[], b: string[]): number {
  const A = new Set(a.map(normalize));
  const B = new Set(b.map(normalize));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function propertyTypeCandidates(propertyType: PropertyType): string[] {
  const map: Record<PropertyType, string[]> = {
    apartment: ["apartment", "شقة", "شقه"],
    villa: ["villa", "فيلا"],
    commercial: ["commercial", "تجاري"],
    land: ["land", "ارض", "أرض"],
  };
  return map[propertyType];
}

function buildPropertyText(p: IProperty) {
  return [
    p.title,
    p.description,
    p.location,
    p.propertyType,
    ...(p.features || []),
    `السعر ${p.price}`,
  ].join(" ");
}

function defaultSlots(): ConversationSlots {
  return {
    role: null,
    payment: null,
    budget: null,
    location: null,
    propertyType: null,
    features: [],
  };
}

function mergeSlots(
  base: ConversationSlots,
  incoming: Partial<ConversationSlots> | null | undefined,
): ConversationSlots {
  if (!incoming) return base;
  return {
    role: incoming.role ?? base.role,
    payment: incoming.payment ?? base.payment,
    budget: incoming.budget ?? base.budget,
    location: incoming.location ?? base.location,
    propertyType: incoming.propertyType ?? base.propertyType,
    features: Array.isArray(incoming.features) && incoming.features.length > 0 ? incoming.features : base.features,
  };
}

function userAgreesToCash(message: string): boolean {
  const t = normalize(message);
  const cashSignals = ["كاش", "نقد", "موافق", "تمام", "yes", "ok", "استمر", "كاشا"];
  const installmentSignals = ["تقسيط", "تمويل", "قسط"];
  return cashSignals.some((s) => t.includes(s)) && !installmentSignals.some((s) => t.includes(s));
}

function computeStep(slots: ConversationSlots): string {
  if (!slots.role) return "ask_role";
  if (!slots.payment) return "ask_payment";
  if (slots.payment === "installment") return "handle_installment";
  if (!slots.budget) return "ask_budget";
  if (!slots.location) return "ask_location";
  if (!slots.propertyType) return "ask_property_type";
  if (!slots.features.length) return "ask_specs";
  return "show_results";
}

function extractRolesFromHistory(history: { role: ChatRole; content: string }[]): string {
  return history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function asChatHistory(input: unknown): { role: ChatRole; content: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is { role: string; content: string } => Boolean(x) && typeof x === "object")
    .map((x) => ({
      role: x.role === "assistant" ? "assistant" : "user",
      content: String(x.content || ""),
    }));
}

/* ================== Extraction ================== */

const ANALYZE_PROMPT = `
أعد JSON فقط بدون شرح أو Markdown.

المطلوب:
{
  "role": "buyer" | "seller" | null,
  "payment": "cash" | "installment" | null,
  "budget": number | null,
  "location": string | null,
  "propertyType": "apartment" | "villa" | "commercial" | "land" | null,
  "features": string[],
  "isComplaint": boolean,
  "complaintSummary": string | null
}

قواعد:
- استخرج فقط ما ذكره المستخدم صراحة.
- لا تفترض حقولاً غير موجودة.
- إذا لم توجد معلومة اجعلها null أو [].
- إذا بدا المستخدم شاكياً اجعل isComplaint=true واملأ complaintSummary.
`;

async function analyze(
  conversationHistory: { role: ChatRole; content: string }[],
  message: string,
): Promise<ExtractedChatJson | null> {
  const res = await callLLM([
    { role: "system", content: ANALYZE_PROMPT },
    ...conversationHistory,
    { role: "user", content: message },
  ]);

  const parsed = safeJsonParse<Record<string, unknown>>(res);
  if (!parsed) return null;

  const role =
    parsed.role === "buyer" || parsed.role === "seller" || parsed.role === null ? parsed.role : null;

  const payment =
    parsed.payment === "cash" || parsed.payment === "installment" || parsed.payment === null
      ? parsed.payment
      : null;

  const budget =
    typeof parsed.budget === "number" && Number.isFinite(parsed.budget) && parsed.budget > 0
      ? Math.round(parsed.budget)
      : null;

  const location = typeof parsed.location === "string" ? parsed.location.trim() || null : null;

  const propertyType =
    parsed.propertyType === "apartment" ||
    parsed.propertyType === "villa" ||
    parsed.propertyType === "commercial" ||
    parsed.propertyType === "land"
      ? parsed.propertyType
      : null;

  const features = Array.isArray(parsed.features)
    ? parsed.features.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
    : [];

  return {
    role,
    payment,
    budget,
    location,
    propertyType,
    features,
    isComplaint: Boolean(parsed.isComplaint),
    complaintSummary: typeof parsed.complaintSummary === "string" ? parsed.complaintSummary : null,
  };
}

/* ================== Personalization / Feedback loop ================== */

async function getUserPreferenceBoost(userId: number): Promise<UserPreferenceDoc | null> {
  const pref = await UserPreferenceModel.findOne({ userId }).lean<UserPreferenceDoc | null>();
  return pref;
}

async function getBehaviorProfile(userId: number): Promise<BehaviorProfileDoc | null> {
  const profile = await BehaviorProfileModel.findOne({ userId }).lean<BehaviorProfileDoc | null>();
  return profile;
}

async function updateUserPreferenceFromSlots(userId: number, slots: ConversationSlots): Promise<void> {
  await UserPreferenceModel.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        preferredLocation: slots.location ?? null,
        maxBudget: slots.budget ?? null,
        preferredType: slots.propertyType ?? null,
        preferredFeatures: slots.features ?? [],
        updatedAt: new Date(),
      },
      $setOnInsert: {
        id: await nextSequence("userPreference"),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function recordInteraction(params: {
  userId: number;
  propertyId: number;
  interactionType: "view" | "save" | "contact" | "scroll" | "time_spent";
  weight?: number;
  seconds?: number | null;
}): Promise<void> {
  await InteractionModel.create({
    id: await nextSequence("interaction"),
    userId: params.userId,
    propertyId: params.propertyId,
    interactionType: params.interactionType,
    weight: params.weight ?? 1,
    seconds: params.seconds ?? null,
    createdAt: new Date(),
  });
}

function applyBehaviorBoosts(
  baseScore: number,
  property: IProperty,
  behavior: BehaviorProfileDoc | null,
): number {
  if (!behavior) return baseScore;

  let score = baseScore;

  if (behavior.boostedPropertyIds?.includes(property.id)) {
    score += 0.75;
  }

  if (behavior.preferredLocation && normalize(property.location).includes(normalize(behavior.preferredLocation))) {
    score += 0.25;
  }

  if (behavior.preferredType && property.propertyType === behavior.preferredType) {
    score += 0.25;
  }

  const overlap = behavior.preferredFeatures?.length
    ? similarity(property.features, behavior.preferredFeatures)
    : 0;

  score += overlap * 0.2;

  return score;
}

async function generateExplanation(property: IProperty, reasons: string[]) {
  const prompt = `
أنت مساعد عقاري عربي.
اكتب سبب ترشيح هذا العقار في سطرين كحد أقصى.
لا تخترع معلومات. استخدم فقط الأسباب التالية:

${reasons.map((r) => `- ${r}`).join("\n")}

العقار:
${property.title} - ${property.location} - ${property.price}
`;

  return callLLM([
    { role: "system", content: prompt },
    { role: "user", content: "اكتب التفسير." },
  ]);
}

/* ================== Hybrid Search ================== */

async function runHybridSearch(slots: ConversationSlots, userId: number): Promise<SearchResult[]> {
  const budget = slots.budget;
  if (!budget) return [];

  const behavior = await getBehaviorProfile(userId);

  const locationRegex = slots.location ? buildLocationRegex(slots.location) : undefined;
  const typeCandidates = slots.propertyType ? propertyTypeCandidates(slots.propertyType) : undefined;

  const baseFilter: Record<string, unknown> = {
    status: "approved",
    price: { $gte: Math.round(budget * 0.8), $lte: Math.round(budget * 1.5) },
    ...(typeCandidates ? { propertyType: { $in: typeCandidates } } : {}),
    ...(locationRegex ? { location: locationRegex } : {}),
  };

  const queryText = [
    slots.location ?? "",
    slots.propertyType ?? "",
    ...slots.features,
    `budget:${slots.budget ?? ""}`,
  ].join(" ");

  const queryEmbedding = await getEmbedding(queryText);

  let candidates: SearchProperty[] = [];

  // Use Atlas vector search when enabled and index exists
  if (ENABLE_ATLAS_VECTOR_SEARCH && MONGODB_VECTOR_INDEX && queryEmbedding.length > 0) {
    try {
      // $vectorSearch must be first stage in the pipeline. It supports pre-filtering and ANN tuning via numCandidates. :contentReference[oaicite:1]{index=1}
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: MONGODB_VECTOR_INDEX,
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: Math.max(100, CANDIDATE_LIMIT * 20),
            limit: CANDIDATE_LIMIT,
            filter: baseFilter,
          },
        },
        {
          $project: {
            title: 1,
            description: 1,
            price: 1,
            location: 1,
            area: 1,
            rooms: 1,
            propertyType: 1,
            features: 1,
            imageUrl: 1,
            imageUrls: 1,
            sellerId: 1,
            status: 1,
            views: 1,
            saves: 1,
            contacts: 1,
            createdAt: 1,
            embedding: 1,
            embeddingTextHash: 1,
            embeddingUpdatedAt: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const vectorResults = await PropertyModel.aggregate(pipeline);
      candidates = vectorResults as SearchProperty[];
    } catch (err) {
      logger.warn({ err }, "Atlas vector search failed; falling back to filtered ranking");
    }
  }

  if (candidates.length === 0) {
    candidates = await PropertyModel.find(baseFilter).limit(CANDIDATE_LIMIT).lean<SearchProperty[]>();
  }

  const scored = await Promise.all(
    candidates.map(async (p) => {
      let embedding = p.embedding || [];

      // caching embeddings: only generate/store if missing or if text hash should be refreshed
      if (!embedding.length) {
        embedding = await getEmbedding(buildPropertyText(p));
        if (embedding.length) {
          await PropertyModel.updateOne(
            { id: p.id },
            {
              $set: {
                embedding,
                embeddingTextHash: null,
                embeddingUpdatedAt: new Date(),
              },
            },
          );
        }
      }

      const semanticScore = queryEmbedding.length && embedding.length ? cosineSimilarity(queryEmbedding, embedding) : 0;

      const priceScore = slots.budget
        ? Math.max(0, 1 - Math.abs(p.price - slots.budget) / slots.budget)
        : 0;

      const locationScore =
        slots.location && normalize(p.location).includes(normalize(slots.location)) ? 1 : 0;

      const typeScore = slots.propertyType && p.propertyType === slots.propertyType ? 1 : 0;

      const featureScore = similarity(p.features, slots.features);

      let finalScore =
        semanticScore * 0.45 +
        priceScore * 0.25 +
        locationScore * 0.15 +
        typeScore * 0.1 +
        featureScore * 0.05;

      finalScore = applyBehaviorBoosts(finalScore, p, behavior);

      const reasons: string[] = [];
      if (semanticScore >= 0.45) reasons.push("متوافق مع المعنى المطلوب");
      if (priceScore >= 0.7) reasons.push("قريب من الميزانية");
      if (locationScore > 0) reasons.push("في الموقع المفضل");
      if (typeScore > 0) reasons.push("بنفس نوع العقار");
      if (featureScore >= 0.2) reasons.push("يحتوي بعض المميزات المطلوبة");

      const explanation = await generateExplanation(p, reasons);

      return {
        id: p.id,
        title: p.title,
        price: p.price,
        location: p.location,
        propertyType: p.propertyType,
        propertyUrl: `/property/${p.id}`,
        score: finalScore,
        explanation,
        matchReasons: reasons,
      } satisfies SearchResult;
    }),
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.price - b.price;
  });

  return scored.slice(0, MAX_RESULTS);
}

/* ================== Route ================== */

router.post("/chat", authMiddleware, async (req, res): Promise<void> => {
  try {
    await ensureMongoConnection();

    const parsed = SendChatMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { message } = parsed.data;
    const userId = req.user!.userId;
    const sessionId = (req.headers["x-chat-session-id"] as string) || "default";

    const chatHistory = asChatHistory((parsed.data as { conversationHistory?: unknown }).conversationHistory);

    const extracted = await analyze(chatHistory, message);

    const state = await ConversationStateModel.findOne({ userId, sessionId }).lean<ConversationStateDoc | null>();

    const slotsBeforeMerge: ConversationSlots = mergeSlots(defaultSlots(), state?.slots || undefined);

    let slots: ConversationSlots = mergeSlots(slotsBeforeMerge, extracted
      ? {
          role: extracted.role,
          payment: extracted.payment,
          budget: extracted.budget,
          location: extracted.location,
          propertyType: extracted.propertyType,
          features: extracted.features,
        }
      : null);

    if (slots.role === "buyer" && userAgreesToCash(message)) {
      slots.payment = "cash";
    }

    let currentStep = extracted?.isComplaint ? "complaint_logged" : computeStep(slots);

    // persist conversation state
    await ConversationStateModel.findOneAndUpdate(
      { userId, sessionId },
      {
        $set: {
          userId,
          sessionId,
          slots,
          currentStep,
          lastUserMessage: message,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          id: await nextSequence("conversationState"), // still safe because schema no longer has unique id in conversation state if you remove it
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (extracted?.isComplaint) {
      await FeedbackModel.create({
        id: await nextSequence("feedback"),
        userId,
        message,
        criteria: extracted.complaintSummary || "شكوى من المحادثة",
      });
    }

    await updateUserPreferenceFromSlots(userId, slots);

    // Search only when ready
    const matchedProperties = currentStep === "show_results" ? await runHybridSearch(slots, userId) : [];

    // explanation + results are returned to frontend
    let reply = "";

    if (currentStep === "complaint_logged") {
      reply = "عذراً لك، تم تسجيل ملاحظتك. هل تود إكمال البحث عن عقار؟";
    } else if (currentStep === "ask_role") {
      reply = "أهلاً بك! هل أنت مشتري أم بائع؟";
    } else if (currentStep === "ask_payment") {
      reply = "كيف تفضل الدفع؟ نقداً (كاش) أم تمويلاً (تقسيط)؟";
    } else if (currentStep === "handle_installment") {
      reply = "حالياً خدمة التقسيط والتمويل العقاري غير متاحة مباشرة في النظام. هل تود الاستمرار بخيار الدفع كاش؟";
    } else if (currentStep === "ask_budget") {
      reply = "ما هي الميزانية المتاحة لديك؟";
    } else if (currentStep === "ask_location") {
      reply = "ما هو الموقع المفضل لديك؟";
    } else if (currentStep === "ask_property_type") {
      reply = "ما نوع العقار الذي تبحث عنه؟ (شقة، فيلا، تجاري، أرض)";
    } else if (currentStep === "ask_specs") {
      reply = "ما هي المواصفات أو المتطلبات الأساسية التي تهمك؟";
    } else if (currentStep === "show_results") {
      reply = matchedProperties.length
        ? "وجدت لك أفضل الخيارات المناسبة، وسأعرضها لك الآن."
        : "لم أجد نتائج مناسبة، هل تريد تعديل الميزانية أو الموقع؟";
    } else {
      reply = "من فضلك كمل البيانات.";
    }

    // feedback loop: record "view-like" engagement for clicked/returned results later in frontend if you hook events
    if (matchedProperties.length > 0) {
      const topIds = matchedProperties.slice(0, 3).map((x) => x.id);
      const profile = await getBehaviorProfile(userId);

      const boostedPropertyIds = Array.from(
        new Set([...(profile?.boostedPropertyIds || []), ...topIds]),
      );

      await BehaviorProfileModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            preferredLocation: slots.location ?? profile?.preferredLocation ?? null,
            maxBudget: slots.budget ?? profile?.maxBudget ?? null,
            preferredType: slots.propertyType ?? profile?.preferredType ?? null,
            preferredFeatures: slots.features ?? profile?.preferredFeatures ?? [],
            boostedPropertyIds,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    const response: {
      reply: string;
      properties?: SearchResult[];
      feedbackCreated?: boolean;
      currentStep?: string;
    } = { reply, currentStep };

    if (matchedProperties.length > 0) {
      response.properties = matchedProperties;
    }

    res.json(response);
  } catch (err) {
    logger.error({ err }, "chat route failed");
    res.status(500).json({
      reply: "حدث خطأ في السيرفر",
    });
  }
});

export default router;