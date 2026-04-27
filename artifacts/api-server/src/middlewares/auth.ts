import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET or SESSION_SECRET must be set");
  }
  return secret;
}

/** Lazy so importing this module does not crash serverless cold starts when env is missing (e.g. health checks). */
function jwtSecret(): string {
  return getJwtSecret();
}

export interface AuthPayload {
  userId: number;
  role: string;
  type?: "access" | "refresh";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, jwtSecret()) as AuthPayload;
    if (decoded.type === "refresh") {
      res.status(401).json({ error: "رمز غير صالح" });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "رمز غير صالح" });
    return;
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "غير مصرح - مدير فقط" });
    return;
  }
  next();
}

/** Sets `req.user` when a valid Bearer token is present; otherwise continues without auth. */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, jwtSecret()) as AuthPayload;
    req.user = decoded;
  } catch {
    // anonymous page view
  }
  next();
}

export function signToken(payload: AuthPayload): string {
  const accessExpiresIn = (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ ...payload, type: "access" }, jwtSecret(), {
    expiresIn: accessExpiresIn,
  });
}

export function signRefreshToken(payload: AuthPayload): string {
  const secret = process.env.REFRESH_TOKEN_SECRET || jwtSecret();
  const refreshExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || "30d") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ ...payload, type: "refresh" }, secret, {
    expiresIn: refreshExpiresIn,
  });
}

export function verifyRefreshToken(token: string): AuthPayload {
  const secret = process.env.REFRESH_TOKEN_SECRET || jwtSecret();
  const decoded = jwt.verify(token, secret) as AuthPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return decoded;
}
