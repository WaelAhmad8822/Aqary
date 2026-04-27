// @ts-nocheck — `dist/app.mjs` is produced by `pnpm -C artifacts/api-server run build` (see vercel.json buildCommand).
/**
 * Vercel type-checks API routes with Node16-style rules on `.ts` sources, which breaks the api-server tree.
 * Import the pre-bundled ESM app instead.
 */
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
