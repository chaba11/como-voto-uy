FROM node:22-slim AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/pipeline/package.json packages/pipeline/
RUN pnpm install --frozen-lockfile --filter=@como-voto-uy/pipeline...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY packages/shared packages/shared
COPY packages/pipeline packages/pipeline
COPY tsconfig.base.json .
RUN pnpm --filter=@como-voto-uy/shared build
RUN pnpm --filter=@como-voto-uy/pipeline build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app .
ENV NODE_ENV=production
ENV DB_PATH=/data/como-voto.db
ENV DATOS_DIR=/data/documentos
VOLUME ["/data"]
CMD ["node", "packages/pipeline/dist/cli.js", "all"]
