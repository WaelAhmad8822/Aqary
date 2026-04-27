import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import {
  authMiddleware,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../middlewares/auth";
import {
  ensureMongoConnection,
  nextSequence,
  UserModel,
  UserPreferenceModel,
  RefreshTokenModel,
  toDateISOString,
} from "../lib/mongo";

const router: IRouter = Router();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function refreshExpiryDate(): Date {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueAuthTokens(user: { id: number; role: string }) {
  const token = signToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  await RefreshTokenModel.create({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiryDate(),
    revokedAt: null,
    createdAt: new Date(),
  });

  return { token, refreshToken };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, phone, role } = parsed.data;

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await nextSequence("users");
  const user = await UserModel.create({
    id: userId,
    name,
    email,
    passwordHash,
    phone: phone || null,
    role: role as "buyer" | "seller",
  });

  await UserPreferenceModel.create({
    id: await nextSequence("userPreferences"),
    userId: user.id,
  });

  const { token, refreshToken } = await issueAuthTokens({
    id: user.id,
    role: user.role,
  });
  res.status(201).json({
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: toDateISOString(user.createdAt),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const user = await UserModel.findOne({ email }).lean();
  if (!user) {
    res.status(401).json({ error: "بريد إلكتروني أو كلمة مرور غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "بريد إلكتروني أو كلمة مرور غير صحيحة" });
    return;
  }

  const { token, refreshToken } = await issueAuthTokens({
    id: user.id,
    role: user.role,
  });
  res.status(200).json({
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: toDateISOString(user.createdAt),
    },
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = sha256(refreshToken);

    const existing = await RefreshTokenModel.findOne({
      tokenHash,
      userId: payload.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!existing) {
      res.status(401).json({ error: "Refresh token is invalid or expired" });
      return;
    }

    await RefreshTokenModel.updateOne(
      { tokenHash },
      { $set: { revokedAt: new Date() } },
    );

    const user = await UserModel.findOne({ id: payload.userId }).lean();
    if (!user) {
      res.status(401).json({ error: "المستخدم غير موجود" });
      return;
    }

    const tokens = await issueAuthTokens({
      id: user.id,
      role: user.role,
    });

    res.status(200).json(tokens);
  } catch {
    res.status(401).json({ error: "Refresh token is invalid or expired" });
  }
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (refreshToken) {
    await RefreshTokenModel.updateOne(
      { tokenHash: sha256(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
  res.status(200).json({ success: true });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  await ensureMongoConnection();
  const user = await UserModel.findOne({ id: req.user!.userId }).lean();
  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: toDateISOString(user.createdAt),
  });
});

export default router;
