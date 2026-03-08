FROM node:22-slim AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile --filter=@como-voto-uy/web...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY packages/shared packages/shared
COPY packages/web packages/web
COPY tsconfig.base.json .
ENV DB_PATH=/data/como-voto.db
RUN pnpm --filter=@como-voto-uy/shared build
RUN pnpm --filter=@como-voto-uy/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/como-voto.db
# Copy Next.js standalone output
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public 2>/dev/null || true
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "packages/web/server.js"]
