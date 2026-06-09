# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=trustbite-server-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
RUN apk add --no-cache wget && \
    addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser -G appgroup
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json package-lock.json ./
COPY --chown=appuser:appgroup src ./src
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "src/server.js"]
