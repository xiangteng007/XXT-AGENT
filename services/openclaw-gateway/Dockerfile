FROM node:20.19.0-alpine3.21 AS builder

WORKDIR /workspace

# Copy and build types package first (dependency)
COPY packages/types/ packages/types/
RUN cd packages/types && npm install --ignore-scripts && npm run build

# Copy gateway source
COPY services/openclaw-gateway/ services/openclaw-gateway/
WORKDIR /workspace/services/openclaw-gateway

# Manually link @xxt-agent/types (avoid file: link issues in Docker)
RUN mkdir -p node_modules/@xxt-agent && \
    cp -r /workspace/packages/types node_modules/@xxt-agent/types

# Install remaining deps — delete lockfile to avoid edgesOut error from file: links
RUN rm -f package-lock.json && \
    npm install --legacy-peer-deps

# Build TypeScript
RUN ./node_modules/.bin/tsc

# ── Production stage ──────────────────────────────────────────
FROM node:20.19.0-alpine3.21 AS runtime

WORKDIR /app

# Copy built output
COPY --from=builder /workspace/services/openclaw-gateway/dist ./dist
COPY --from=builder /workspace/services/openclaw-gateway/package.json .

# Copy types package dist (runtime dependency)
COPY --from=builder /workspace/packages/types/dist ./node_modules/@xxt-agent/types/dist
COPY --from=builder /workspace/packages/types/package.json ./node_modules/@xxt-agent/types/package.json

# Production deps only — delete lockfile, manually link types
RUN rm -f package-lock.json && \
    npm install --omit=dev --legacy-peer-deps

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
