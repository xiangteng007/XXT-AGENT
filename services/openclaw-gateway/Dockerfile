FROM node:20.19.0-alpine3.21 AS builder

WORKDIR /workspace

# Copy types package first (dependency)
COPY packages/types/ packages/types/
RUN cd packages/types && npm ci && npm run build

# Copy gateway source
COPY services/openclaw-gateway/ services/openclaw-gateway/
WORKDIR /workspace/services/openclaw-gateway

RUN npm ci
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20.19.0-alpine3.21 AS runtime

WORKDIR /app

# Copy built output
COPY --from=builder /workspace/packages/types/dist /workspace/packages/types/dist
COPY --from=builder /workspace/packages/types/package.json /workspace/packages/types/package.json
COPY --from=builder /workspace/services/openclaw-gateway/dist ./dist
COPY --from=builder /workspace/services/openclaw-gateway/package.json .
COPY --from=builder /workspace/services/openclaw-gateway/package-lock.json .

# Production deps only
RUN npm ci --omit=dev

# Agent configs (mounted as volume in Cloud Run, or baked-in for immutable builds)
COPY .agent/agents/ /app/.agent/agents/

# H-08: 非 root 使用者執行
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
RUN chown -R nodeuser:nodejs /app
USER nodeuser

ENV NODE_ENV=production
ENV PORT=3100
ENV AGENTS_CONFIG_DIR=/app/.agent/agents

EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- http://localhost:3100/health || exit 1

CMD ["node", "dist/index.js"]
