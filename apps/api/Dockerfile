# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
# Alpine's musl libc ships OpenSSL 3.x, but without the `openssl` package
# itself Prisma's runtime can't detect that version and silently assumes
# 1.1 — pulling in a query engine binary that fails to `dlopen` (missing
# libssl.so.1.1). Installing it here fixes detection in both the build
# stage (where `prisma generate` picks the right target) and the runtime
# stage (where the engine actually loads).
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /workspace

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hrms/api prisma:generate
RUN pnpm --filter @hrms/api build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
RUN addgroup -S hrms && adduser -S hrms -G hrms
WORKDIR /workspace

# Keeping the same directory layout as the build stage (root node_modules
# + apps/api/node_modules, both pnpm symlink trees) is what lets those
# symlinks keep resolving correctly — no `pnpm deploy` dereferencing step
# required.
COPY --from=build --chown=hrms:hrms /workspace/node_modules ./node_modules
COPY --from=build --chown=hrms:hrms /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=build --chown=hrms:hrms /workspace/apps/api ./apps/api

USER hrms
WORKDIR /workspace/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
