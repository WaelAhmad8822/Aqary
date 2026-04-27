# Aqary - Arabic Real Estate Platform

## Overview

Aqary (عقاري) is an Arabic-first (RTL) real estate platform with role-based dashboards for buyers, sellers, and admins.  
The project is organized as a pnpm monorepo with separate frontend and backend apps.

## Project Structure

- `artifacts/aqary`: Frontend (React + Vite)
- `artifacts/api-server`: Backend API (Express + TypeScript)
- `lib/api-spec`: OpenAPI specification
- `lib/api-zod`: Shared request/response validation schemas
- `lib/api-client-react`: Generated React API client/hooks

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React, Vite, React Query, Tailwind, RTL Arabic UI
- **Backend**: Express 5, TypeScript, esbuild build script
- **Database**: MongoDB (Mongoose models in backend)
- **Auth**: JWT + bcryptjs
- **Chatbot**: LLM chat integration via backend route (`/chat`) and external model endpoint
- **Validation/Contracts**: OpenAPI + Zod + generated client

## Run Locally

### 1) API server

From `artifacts/api-server`:

- `corepack pnpm dev`

Default API port in current setup: `5001`.

### 2) Frontend app

From `artifacts/aqary`:

- `corepack pnpm dev`

Then open the local Vite URL shown in terminal.

## Useful Commands

From repo root:

- `pnpm run typecheck` - typecheck workspace packages
- `pnpm run build` - build workspace packages
- `pnpm --filter @workspace/api-spec run codegen` - regenerate API client/schemas from OpenAPI

## Main Features

- Authentication and role-based access (`buyer`, `seller`, `admin`)
- Property CRUD and moderation workflow
- User interaction tracking (views, saves, contacts, etc.)
- Recommendation engine and match reasons
- AI chat assistant flow for property discovery and complaint capture
- Seller dashboard for property management

## Chatbot (AI Assistant) — Full Details

The chatbot is an **Arabic real-estate assistant** available in the frontend as a floating widget (only visible when the user is logged in). The backend endpoint is implemented in `artifacts/api-server/src/routes/chat.ts`.

### What the chatbot does

- **Property discovery (buyers)**: collects requirements (budget, location, type, features), then suggests up to 3 matching properties with **human-readable match reasons**.
- **Complaint capture (any user)**: detects complaints, stores them in the database as feedback, and replies with an apology/confirmation.
- **One-question-at-a-time UX**: the model is prompted to ask a single follow-up question when information is missing.

### Backend API

- **Endpoint**: `POST /chat`
- **Auth**: required (JWT). The route is protected by `authMiddleware`.
- **Body schema**: validated with Zod (`SendChatMessageBody` from `@workspace/api-zod`)
  - `message: string`
  - `conversationHistory?: { role: "user" | "assistant"; content: string }[]`
- **Optional session header**: `x-chat-session-id` (defaults to `"default"` if missing)
  - Used to store separate conversation slot state per session.

### Response shape

The backend returns:

- **`reply`**: the assistant text reply (Arabic, concise)
- **`properties?`**: array of matched properties (when a search is triggered)
- **`feedbackCreated?`**: `true` when the message was classified as a complaint and stored

### How it works internally (step-by-step)

1. **Conversation analysis with the LLM**
   - The backend calls an external model endpoint compatible with Ollama-style `/api/chat`.
   - The model is asked to return **JSON-only** analysis, including:
     - Slots: `role`, `payment`, `budget`, `location`, `propertyType`, `features`
     - Flags: `isComplaint`, `shouldSearchProperties`
     - UX fields: `missingField`, `nextQuestion`, `userSummary`
2. **Complaint handling**
   - If `isComplaint=true`, a record is created in `FeedbackModel` with a short `criteria/summary`.
3. **Slot persistence**
   - Slots are merged with persisted state in `ConversationStateModel` by `(userId, sessionId)`.
   - This enables multi-turn collection of requirements across multiple messages.
4. **Property shortlist (database query)**
   - When the user is a buyer and data is sufficient (budget + type, and usually location), the backend queries `PropertyModel`:
     - Always filters `status: "approved"`
     - Budget is treated as a soft constraint: `price <= budget * 1.15`
     - First tries with location; if no results, falls back to ignoring location.
5. **Match reasons (deterministic)**
   - Each candidate gets reasons via `getMatchReasons()` from `lib/cosineSimilarity.ts`:
     - Examples: "يناسب ميزانيتك", "قريب من ميزانيتك", "في موقعك المفضل", "نوع العقار المطلوب", "يحتوي على مواصفات مطلوبة"
6. **Final ranking (LLM rerank)**
   - Candidates are optionally re-ranked by the model returning JSON `{ "rankedIds": [...] }`.
   - If reranking fails, the fallback ranking uses the number of match reasons.
7. **Final reply generation**
   - The final answer is produced by the model (not JSON), using the analysis + top matches.

### Chat model configuration

The backend calls:

- `POST {OLLAMA_BASE_URL}/api/chat`
- Model name currently hardcoded as `"llama3"`

Required environment variables:

- `OLLAMA_BASE_URL` (or `LLM_BASE_URL`) — base URL of the model server (example: `http://localhost:11434`)

Behavior when not configured:

- If `OLLAMA_BASE_URL`/`LLM_BASE_URL` is missing, `/chat` returns a friendly Arabic message indicating the service is not configured.

### Frontend integration

- UI component: `artifacts/aqary/src/components/chat/ChatWidget.tsx`
- Hook: `useSendChatMessage` from `@workspace/api-client-react`
- The widget:
  - sends `message` + `conversationHistory`
  - renders `response.reply`
  - renders `response.properties` as quick property cards with match-reason chips

## Recommendation System — Full Details

Recommendations are computed on the backend in `artifacts/api-server/src/routes/recommendations.ts` and displayed on the home page when the user is logged in.

### Backend API

- **Endpoint**: `GET /recommendations`
- **Auth**: required (JWT)
- **Response**: up to 10 approved properties sorted by descending `matchScore` (0–100), each including `matchReasons`.

### Data sources (MongoDB collections/models)

- **`UserPreferenceModel`**: explicit preferences saved for the user:
  - `maxBudget`, `preferredLocation`, `preferredType`, `preferredFeatures[]`
- **`InteractionModel`**: implicit behavior signals per property:
  - interaction types: `view`, `save`, `contact`, `scroll`, `time_spent`
- **`PropertyModel`**: candidate pool (only `status: "approved"`)

### Scoring algorithm (hybrid: content + behavior)

Each property gets:

- **Content similarity**: cosine similarity between
  - `userVector = buildUserVector(maxBudget, preferredLocation, preferredType, preferredFeatures)`
  - `propertyVector = buildPropertyVector(price, location, propertyType, features)`
- **Behavior score (normalized)**: summed interaction weights per property, normalized by the max across the user’s interactions.

Final score:

\[
\text{finalScore} = 0.6 \times \text{contentScore} + 0.4 \times \text{normalizedBehavior}
\]

Then:

- `matchScore = round(finalScore * 100)`
- sort descending and return top 10

### Interaction weights

Defined in `artifacts/api-server/src/lib/cosineSimilarity.ts`:

- `view: 1`
- `save: 3`
- `contact: 5`
- `scroll: 0.5`
- `time_spent: 0.1 * seconds`

### Explainability (“match reasons”)

For each returned recommendation, the API includes `matchReasons` generated deterministically by `getMatchReasons()`, e.g.:

- budget fit / near budget (within +15%)
- preferred location match
- preferred type match
- overlapping preferred features
- fallback: "مقترح لك"

### Frontend usage

- Home page calls `useGetRecommendations()` and renders a “مقترحة لك” section when results exist:
  - `artifacts/aqary/src/pages/home.tsx`

### Tracking interactions (to improve recommendations)

The backend exposes:

- `POST /track` (auth required) to store property interactions and increment property counters
- `POST /track/page-view` (auth optional) to store page visits

These routes are implemented in `artifacts/api-server/src/routes/interactions.ts`.

## Notes

- Keep `.env` values configured for backend runtime (DB connection, JWT secrets, and any chat provider settings).

## Vercel Deployment

This repo is configured for Vercel with:

- Static frontend output from `artifacts/aqary/dist/public`
- Serverless API entry at `api/[...all].ts` (Express app)

In the Vercel project **Settings → General → Root Directory**, use the **repository root** (`.`). The root `vercel.json` build runs **API server esbuild first**, then the Vite frontend:

`pnpm -C artifacts/api-server run build && pnpm -C artifacts/aqary run build:web`

That produces `artifacts/api-server/dist/app.mjs`, which `api/[...all].ts` imports so Vercel does not type-check raw `artifacts/api-server/src/**/*.ts` with Node16 rules (which previously failed the deploy).

If you still see **`ERR_PNPM_NO_SCRIPT` for `build:web`**, open **Project → Settings → General → Build & Development Settings** and remove any **custom Build Command** that overrides `vercel.json` (leave it empty to use the file), or set **Root Directory** to the repository root.

If you must set Root Directory to **`artifacts/aqary`**, override in the Vercel UI: **Build Command** `pnpm run build`, **Output Directory** `dist/public`, and keep **`api/`** at the repo root by using a monorepo setup or moving the API — simplest is to keep Root Directory at the repo root.

In **Framework Preset**, choose **Other** (or leave auto-detect off). The repo `vercel.json` sets `"framework": null` so Vercel treats the build output as a **static site** (HTML/JS/CSS from Vite), not a Node server entry in that folder.

If you see **“No entrypoint found in output directory”**, it usually means Vercel was treating the output like a server app. Using **Framework: Other** / `framework: null` fixes that.

If the build step fails, open the full log on Vercel. Common causes:

- **Install failed** (before build): run `pnpm install` locally with the same lockfile; if `minimumReleaseAge` in `pnpm-workspace.yaml` blocks a new package, you may need to wait or adjust the allowlist.
- **`ERR_PNPM_NO_SCRIPT` for `build:web`**: clear the dashboard **Build Command** override, or ensure `build:web` exists in the `package.json` for your chosen Root Directory (this repo defines it in both places).

Set these Environment Variables in Vercel Project Settings:

- `MONGODB_URI` (or `DATABASE_URL`) — **required** for any route that uses the database (without it, those requests fail).
- `MONGODB_DB_NAME` (optional, defaults to `aqary`)
- `JWT_SECRET` (or `SESSION_SECRET`) — **required** for login/register and any authenticated route.
- `OLLAMA_BASE_URL` (or `LLM_BASE_URL`) for chatbot model endpoint

If the serverless function returns **500 / FUNCTION_INVOCATION_FAILED**, open **Vercel → Project → Logs** and check for missing env or Mongo connection errors. **`GET /api/healthz`** should respond with JSON even when only part of the stack is configured, so you can confirm the function is running.

Optional notes:

- Keep API calls relative (`/api/...`) from the frontend.
- If chatbot provider is not configured, chat returns a friendly "service not configured" message.
