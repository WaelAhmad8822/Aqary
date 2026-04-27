import { Router, type IRouter } from "express";
import { CreateFeedbackBody, AdminApprovePropertyParams, AdminRejectPropertyParams, AdminResolveFeedbackParams } from "@workspace/api-zod";
import { authMiddleware, adminMiddleware } from "../middlewares/auth";
import {
  ensureMongoConnection,
  UserModel,
  PropertyModel,
  InteractionModel,
  FeedbackModel,
  PageViewModel,
  nextSequence,
  toDateISOString,
} from "../lib/mongo";

const router: IRouter = Router();

function formatProperty(p: {
  id: number;
  title: string;
  description: string;
  price: number;
  location: string;
  area: number;
  rooms?: number | null;
  propertyType: "apartment" | "villa" | "commercial" | "land";
  features: string[];
  imageUrl?: string | null;
  imageUrls?: string[];
  sellerId: number;
  status: "pending" | "approved" | "rejected";
  views: number;
  saves: number;
  contacts: number;
  createdAt: Date;
}) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    location: p.location,
    area: p.area,
    rooms: p.rooms ?? null,
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
  };
}

router.get("/admin/users", authMiddleware, adminMiddleware, async (_req, res): Promise<void> => {
  await ensureMongoConnection();
  const users = await UserModel.find().sort({ createdAt: -1 }).lean();
  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: toDateISOString(u.createdAt),
  })));
});

router.get("/admin/properties", authMiddleware, adminMiddleware, async (_req, res): Promise<void> => {
  await ensureMongoConnection();
  const properties = await PropertyModel.find().sort({ createdAt: -1 }).lean();
  res.json(properties.map(formatProperty));
});

router.patch("/admin/properties/:id/approve", authMiddleware, adminMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const params = AdminApprovePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const property = await PropertyModel.findOneAndUpdate(
    { id: params.data.id },
    { status: "approved" },
    { new: true },
  ).lean();

  if (!property) {
    res.status(404).json({ error: "العقار غير موجود" });
    return;
  }

  res.json(formatProperty(property));
});

router.patch("/admin/properties/:id/reject", authMiddleware, adminMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const params = AdminRejectPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const property = await PropertyModel.findOneAndUpdate(
    { id: params.data.id },
    { status: "rejected" },
    { new: true },
  ).lean();

  if (!property) {
    res.status(404).json({ error: "العقار غير موجود" });
    return;
  }

  res.json(formatProperty(property));
});

router.get("/admin/feedbacks", authMiddleware, adminMiddleware, async (_req, res): Promise<void> => {
  await ensureMongoConnection();
  const feedbacks = await FeedbackModel.find().sort({ createdAt: -1 }).lean();
  res.json(feedbacks.map(f => ({
    id: f.id,
    userId: f.userId,
    message: f.message,
    criteria: f.criteria,
    resolved: f.resolved,
    createdAt: toDateISOString(f.createdAt),
  })));
});

router.post("/admin/feedback", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const feedback = await FeedbackModel.create({
    id: await nextSequence("feedback"),
    userId: req.user!.userId,
    message: parsed.data.message,
    criteria: parsed.data.criteria || null,
  });

  res.status(201).json({
    id: feedback.id,
    userId: feedback.userId,
    message: feedback.message,
    criteria: feedback.criteria,
    resolved: feedback.resolved,
    createdAt: toDateISOString(feedback.createdAt),
  });
});

router.patch("/admin/feedbacks/:id/resolve", authMiddleware, adminMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const params = AdminResolveFeedbackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const feedback = await FeedbackModel.findOneAndUpdate(
    { id: params.data.id },
    { resolved: true },
    { new: true },
  ).lean();

  if (!feedback) {
    res.status(404).json({ error: "الملاحظة غير موجودة" });
    return;
  }

  res.json({
    id: feedback.id,
    userId: feedback.userId,
    message: feedback.message,
    criteria: feedback.criteria,
    resolved: feedback.resolved,
    createdAt: toDateISOString(feedback.createdAt),
  });
});

router.get("/admin/analytics", authMiddleware, adminMiddleware, async (_req, res): Promise<void> => {
  await ensureMongoConnection();
  const [
    userCount,
    propCount,
    interCount,
    pendingCount,
    feedbackCount,
    pageViewCount,
    interByTypeAgg,
    pageViewsByPathAgg,
    topProps,
    interPerUser,
    pvPerUser,
  ] = await Promise.all([
    UserModel.countDocuments(),
    PropertyModel.countDocuments(),
    InteractionModel.countDocuments(),
    PropertyModel.countDocuments({ status: "pending" }),
    FeedbackModel.countDocuments({ resolved: false }),
    PageViewModel.countDocuments(),
    InteractionModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$interactionType", count: { $sum: 1 } } },
    ]),
    PageViewModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$path", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
    ]),
    PropertyModel.find()
      .sort({ views: -1 })
      .limit(10)
      .select({ id: 1, title: 1, views: 1, saves: 1, contacts: 1, sellerId: 1 })
      .lean(),
    InteractionModel.aggregate<{ _id: number; interactionCount: number }>([
      { $group: { _id: "$userId", interactionCount: { $sum: 1 } } },
      { $sort: { interactionCount: -1 } },
      { $limit: 25 },
    ]),
    PageViewModel.aggregate<{ _id: number; pageViewCount: number }>([
      { $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", pageViewCount: { $sum: 1 } } },
    ]),
  ]);

  const interactionsByType: Record<string, number> = {};
  for (const row of interByTypeAgg) {
    interactionsByType[row._id] = row.count;
  }

  const pageViewsByPath = pageViewsByPathAgg.map((row) => ({
    path: row._id,
    count: row.count,
  }));

  const topPropertiesByViews = topProps.map((p) => ({
    id: p.id,
    title: p.title,
    views: p.views,
    saves: p.saves,
    contacts: p.contacts,
    sellerId: p.sellerId,
  }));

  const pvMap = new Map(pvPerUser.map((p) => [p._id, p.pageViewCount]));
  const userIds = interPerUser.map((r) => r._id);
  const users = await UserModel.find({ id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u.id, u]));

  const userActivity = interPerUser.map((row) => {
    const u = userMap.get(row._id);
    return {
      userId: row._id,
      name: u?.name ?? "",
      email: u?.email ?? "",
      interactionCount: row.interactionCount,
      pageViewCount: pvMap.get(row._id) ?? 0,
    };
  });

  res.json({
    totalUsers: userCount,
    totalProperties: propCount,
    totalInteractions: interCount,
    pendingProperties: pendingCount,
    unresolvedFeedbacks: feedbackCount,
    totalPageViews: pageViewCount,
    interactionsByType,
    pageViewsByPath,
    topPropertiesByViews,
    userActivity,
  });
});

export default router;
