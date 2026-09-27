# Persian Dark Horse

Persian Dark Horse is an AI Universe workspace where specialized agents help users think, create, build, play, and grow from one command center.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fezi-ai/src/App.tsx` and `src/pages/` — route shell plus focused dashboard, chat, profile, project, connector, skill, billing, settings, and Guardian views
- `artifacts/fezi-ai/src/lib/i18n.ts` — complete Persian/English UI dictionary and API-content localization helpers
- `artifacts/fezi-ai/src/lib/store.ts` — local persistence for profile, personalization, projects, connector profiles, skills, and app settings
- `artifacts/fezi-ai/src/index.css` — Persian Dark Horse black/gold visual system and Android-like interaction motion
- `artifacts/api-server/src/routes/fezi-data.ts` — typed preview API for agents, dashboard, chat, plans, and payment quotes
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` — generated client hooks and validation schemas

## Architecture decisions

- The public-facing site name is **Persian Dark Horse** in every language and on every page, including navigation, auth screens, metadata, sharing, and notifications. FEZI remains the name of a specific agent and of legacy internal IDs; do not use FEZI AI as the site brand.
- The frontend uses generated React Query hooks against the shared `/api` service rather than embedding agent data in components.
- All-agent chat tries the direct DeepSeek API first, then OpenRouter with the DeepSeek model, followed by Mistral, Ollama, Grok, and OpenAI. The direct DeepSeek key is currently rejected by the provider, while OpenRouter/DeepSeek is verified working. Chat language is detected from the user's message and enforced in the model system prompt; Preview is only the final honest fallback.
- Agent responses can be converted to server-generated MP3 audio through Speechify. English uses English voices; Persian-script text uses the closest RTL voice available in the connected Speechify workspace.
- Agent access and payment wallet/network data are represented in typed API responses so plan rules and admin configuration can move server-side without rewriting the UI.
- The visual system uses deep black/charcoal surfaces, warm gold accents, the Persian Dark Horse mark, and tactile Android-like controls.
- The complete app shell is bilingual. Language selection persists, immediately updates `lang` and RTL/LTR direction, and localizes API-backed plan, agent, dashboard, and activity content.
- User-created profile data, projects, connector profiles, skills, personalization, and settings persist locally. Connector profiles never collect or store secrets and do not claim OAuth authentication.

## Product

- Overview dashboard with plan, credits, Guardian status, activity, and all five agents
- `/chat` workspace with agent switching, conversation history, keyboard send, provider-backed responses for MANIKA/ARTA, per-response Listen/Stop controls, and an honest Preview fallback
- `/agents/:id` profile pages backed by the uploaded master Agent specification, including bilingual capabilities, access tier, mode, tool mapping, personality matrix, philosophy, and working relationship
- `/profile` and `/personalize` for personal identity plus black/charcoal and gold appearance choices
- `/projects` for locally persisted project CRUD
- `/connectors` for locally persisted, non-secret connection profiles
- `/skills` for creating, activating, editing, and deleting bilingual reusable skills
- `/settings` for persistent Persian/English language, direction, notification preference, and voice controls
- `/billing` plans plus 22 API-served currency/network destinations, per-currency logos, exact wallet copy action, address QR modal, expiry, and wrong-network warning
- `/admin` Guardian operations view with service health and explicit preview status

## User preferences

- The user wants a friendly, premium, Android-like black/gold product built around the Persian Dark Horse logo, with complete Persian and English coverage. Crypto remains a payment method rather than the product identity.

## Gotchas

- The frontend artifact build expects workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for preview.
- Payment verification remains Preview-only. Free chat providers are connected, but account quota/access errors can still trigger the explicit Preview fallback.
- The five Agent portraits come from the user-provided source images. The four-panel image is cropped by quadrant for Arta, Arvin, Negar, and FEZI; Manika uses the separate portrait.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
