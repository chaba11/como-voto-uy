FROM node:22-slim AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY packages/shared packages/shared
COPY packages/pipeline packages/pipeline
COPY packages/web packages/web
COPY tsconfig.base.json .
RUN pnpm --filter=@como-voto-uy/shared build
RUN pnpm --filter=@como-voto-uy/pipeline build
# Run pipeline to generate DB
RUN mkdir -p /data && DB_PATH=/data/como-voto.db node packages/pipeline/dist/cli.js all --camara=senado --legislatura=50
RUN DB_PATH=/data/como-voto.db node packages/pipeline/dist/cli.js representantes
# Build web
ENV DB_PATH=/data/como-voto.db
RUN pnpm --filter=@como-voto-uy/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/como-voto.db
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Copy Next.js standalone output
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
# Copy pre-built database
COPY --from=builder /data/como-voto.db /data/como-voto.db
# public directory is optional
RUN mkdir -p ./packages/web/public
EXPOSE 3000
CMD ["node", "packages/web/server.js"]
