*** Enrichment & worker tests (skeleton) ***

I added a worker and queue implementation under artifacts/api-server/src/jobs and artifacts/api-server/src/workers.

Tests are provided as a starting point in artifacts/api-server/test/ but require project test runner and dev dependencies to be installed before running.

To run the worker locally:

1. Ensure environment variables are set (MONGODB_URI, OPENROUTER_API_KEY).
2. From the repo root run:
   pnpm -C artifacts/api-server run build
   node ./dist/src/workers/enrichmentWorker.mjs

Migration script:

  pnpm -C artifacts/api-server run build
  node ./dist/src/migrations/add_explanation_cached.mjs

Notes:
- The migration script imports getEmbedding from chat.ts. To use it from compiled code you must build the api-server first (build step compiles files to dist).
- The worker polls the EnrichmentJob collection and updates property.explanationCached when LLM returns text.

If you want, I can also add runnable unit tests (jest + ts-jest) and hooks to CI. Please confirm if you'd like me to add those deps and a working test script.
