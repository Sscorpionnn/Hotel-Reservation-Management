# syntax=docker/dockerfile:1
FROM node:26-alpine AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hrms/web build

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S hrms && adduser -S hrms -G hrms
WORKDIR /app

# Next.js standalone output already contains a pruned node_modules with
# only what's needed to run `server.js` — no package manager required.
COPY --from=build --chown=hrms:hrms /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=hrms:hrms /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=hrms:hrms /workspace/apps/web/public ./apps/web/public

USER hrms
EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/login',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
