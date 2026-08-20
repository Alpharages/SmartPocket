# syntax=docker/dockerfile:1

# The API half of SmartPocket. The Expo client is not built here — it ships
# through EAS / expo export, and nothing in this image serves it.

# ─────────────────────────────────────────────────────────────────────────────
# builder — also the image the `migrate` compose service runs from
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# .npmrc carries `node-linker=hoisted`; the install layout is wrong without it.
COPY package.json pnpm-lock.yaml .npmrc ./

# There is one package.json for both halves of the repo, so this pulls the
# whole Expo/React Native tree to build a server bundle that uses none of it.
# The stage is discarded, so the cost is build time — and the store cache mount
# keeps that off the critical path on every rebuild after the first.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm build:server

# ─────────────────────────────────────────────────────────────────────────────
# runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# One self-contained CJS bundle — there is no node_modules in this image.
# The bundle must be CJS: as ESM some dependency's `require("fs")` becomes
# "Dynamic require of \"fs\" is not supported" and the process dies on import.
COPY --from=builder /app/dist/server.cjs ./server.cjs

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.cjs"]
