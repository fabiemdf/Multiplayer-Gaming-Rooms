# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first for better layer caching
COPY package*.json ./

RUN npm ci --omit=dev

# ── Runtime stage ───────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Add tini for proper signal handling (PID 1)
RUN apk add --no-cache tini

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Never run as root in production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port (override with PORT env var at runtime)
EXPOSE 3000

ENV NODE_ENV=production

# Health check uses the /health endpoint we added
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"status":"ok"'

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
