# Vercel Deployment

This project is now configured to deploy as a single Vercel project:
- Frontend: static Vite build from `artifacts/aqary`
- API: serverless function from `api/[...all].ts` serving the Express app

## Required Environment Variables

Set these in your Vercel project settings:

- `MONGODB_URI` (or `DATABASE_URL`) - MongoDB connection string (required; MongoDB Atlas recommended)
- `MONGODB_DB_NAME` - Database name (optional, defaults to `aqary`)
- `JWT_SECRET` - JWT signing secret (required)
- `NODE_ENV` - set to `production`

## Build and Output

- Install command: `corepack enable && pnpm install --frozen-lockfile`
- Build command: `pnpm -C artifacts/api-server run build && pnpm -C artifacts/aqary run build:web`
- Output directory: `artifacts/aqary/dist/public`

## Troubleshooting MongoDB Connection Issues

### Problem: MongoDB connection works locally but fails on Vercel

**Root Cause**: Vercel serverless functions are stateless and ephemeral. The connection promise is not persisted between function invocations.

**Solutions**:

1. **Verify Environment Variables** (Most Common Issue)
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Ensure `MONGODB_URI` is set with your MongoDB Atlas connection string
   - Ensure `MONGODB_DB_NAME` is set (or it defaults to `aqary`)
   - Redeploy after adding/updating variables

2. **Check MongoDB Atlas Network Access**
   - MongoDB Atlas → Network Access
   - Whitelist Vercel's IP ranges or use `0.0.0.0/0` (allows all IPs - use with caution)
   - Ensure your IP is not too restrictive

3. **Test Connection with Health Check**
   - Deploy your app
   - Test: `https://your-vercel-app.vercel.app/api/healthz`
   - Should return: `{ "status": "ok", "db": "connected" }`
   - If DB is disconnected, check Vercel logs for connection errors

4. **Check Vercel Logs**
   - Vercel Dashboard → Project → Deployments → Latest → Logs
   - Look for MongoDB connection timeout or authentication errors
   - Common errors:
     - `MONGODB_URI is not set` → Missing environment variable
     - `connect ENOTFOUND` → Network/firewall issue
     - `authentication failed` → Wrong credentials in connection string

5. **Connection Pooling Configuration**
   - The updated `mongo.ts` now includes:
     - `maxPoolSize: 10` - Maximum connections
     - `minPoolSize: 2` - Minimum connections
     - `socketTimeoutMS: 45000` - Close idle connections after 45s
     - `serverSelectionTimeoutMS: 5000` - Timeout for server selection
     - `retryWrites: true` - Enable automatic retries
   - These settings optimize connection handling for serverless functions

## Notes

- API routes are available under `/api/*`.
- SPA routes are rewritten to `index.html`.
- The frontend already calls relative `/api/...` endpoints, so no client API URL changes are required for same-origin deployment.
- Health check endpoint `/api/healthz` can be used to verify both API and database connectivity.
