# ═══════════════════════════════════════════════════════════════════════════════
# Sentinel AI VMS — Multi-Stage Production Dockerfile
#
# Stage 1: deps        — install all node_modules (cached layer)
# Stage 2: builder     — compile TypeScript frontend + backend
# Stage 3: production  — minimal runtime image (no dev deps, no source)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Dependency installation ─────────────────────────────────────────
FROM node:20-slim AS deps

# System packages needed for native modules (onnxruntime, canvas, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Vite frontend (outputs to dist/)
RUN npm run build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-slim AS production

# Security: run as non-root
RUN groupadd -r sentinel && useradd -r -g sentinel -u 1001 sentinel

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production node_modules only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Copy runtime assets (models, migrations, monitoring configs)
COPY --from=builder /app/models ./models
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/eng.traineddata ./eng.traineddata

# Healthcheck script
COPY scripts/healthcheck.sh /usr/local/bin/healthcheck
RUN chmod +x /usr/local/bin/healthcheck

# Data directory (will be overridden by volume in k8s/compose)
RUN mkdir -p /app/.data && chown sentinel:sentinel /app/.data

# Switch to non-root user
USER sentinel

# Expose application port
EXPOSE 5000

# Prometheus metrics port
EXPOSE 9090

# Environment defaults (override at runtime)
ENV NODE_ENV=production \
    PORT=5000 \
    LOG_LEVEL=info \
    METRICS_PORT=9090

# Kubernetes health probes
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck

# Graceful shutdown: Node.js handles SIGTERM
STOPSIGNAL SIGTERM

CMD ["node", "dist/server.cjs"]
