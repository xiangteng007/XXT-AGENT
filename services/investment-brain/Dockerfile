# ═══════════════════════════════════════════════════════════════
# Investment Brain — Production Dockerfile
# Multi-stage build with security hardening
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency spec
COPY pyproject.toml ./

# Install Python packages into a virtual env
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -e .

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Security: non-root user
RUN groupadd -r brain && \
    useradd -r -g brain -d /app -s /sbin/nologin brain

WORKDIR /app

# Copy virtual env from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Ensure correct ownership
RUN chown -R brain:brain /app

# Switch to non-root user
USER brain

# Expose port
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8090/health')"

# Labels
LABEL maintainer="XXT-AGENT" \
      service="investment-brain" \
      version="0.2.0"

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
