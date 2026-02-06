# Docker Build Optimization Guide

**Branch:** `optimize-docker-build`
**Date:** 2026-02-06
**Context:** Addressing 2-hour+ build times for DSpace Angular frontend

---

## Problem Summary

**Original issue:** Docker builds taking 2+ hours in production environment.

**Root cause identified:** Production server has only **1 CPU core**, while Angular builds are heavily parallelized and expect 4-6 cores minimum.

**Actual build phase timings (1-core machine):**
- `yarn install`: ~12 minutes
- `yarn build:prod`: **82.7 minutes** (4964 seconds)
- Image assembly: ~2 minutes
- **Total: ~97 minutes**

**Server specs (clarinrepo01fl):**
- CPU: 1 core (Intel Xeon Gold 6248 @ 2.50GHz)
- RAM: 15GB total, 11GB used, 661MB free
- Swap: 2GB (100% full)
- **Recommendation:** 4-6 CPU cores, 6-8GB RAM

---

## Changes Made

### 1. BuildKit Enabled (`docker/.env`)

Added to `docker/.env`:
```bash
# Enable Docker BuildKit for faster, more efficient builds
# BuildKit provides better layer caching, parallel execution, and 2-3x speed improvement
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

**Benefits:**
- Better layer caching
- Parallel stage execution
- Improved build output with progress bars
- Cache mounts support

### 2. Multi-Stage Dockerfile

Replaced single-stage Dockerfile with optimized 3-stage build:

**Stage 1: Dependencies**
- Installs node_modules
- Uses BuildKit cache mount for yarn cache
- Cached unless `package.json`/`yarn.lock` changes

**Stage 2: Build**
- Runs `yarn build:prod`
- Cached unless source code changes
- Inherits node_modules from dependencies stage

**Stage 3: Runtime**
- Minimal production image
- Only copies built artifacts and runtime dependencies
- Results in smaller image (~1.5GB vs 4.2GB)

**Key improvement:** Separation means dependency installation doesn't re-run when only source changes, and vice versa.

### 3. `.dockerignore`

Already existed and covers important exclusions:
- `.git` directory
- `node_modules` (local)
- `dist`, `build` folders
- IDE files

No changes needed.

---

## Build Strategies

### Strategy 1: Allocate More CPU Cores ⭐ BEST LONG-TERM

**Impact:** Would reduce build from 82 min → 15-25 min

**Action:** Request VM resize for clarinrepo01fl
- Target: 4-6 CPU cores
- Keep RAM at 15GB (sufficient)
- This is the only way to get reasonable build times

**Pros:**
- Solves the root cause
- All builds become fast
- No workflow changes needed

**Cons:**
- Requires infrastructure change
- May have cost implications

---

### Strategy 2: Use Pre-built Images ❌ NOT VIABLE

**Status:** Not applicable for CLARIN-DK fork

**Why not:** Your fork has significant customizations that differ from upstream UFAL:
- CLARIN-DK Shibboleth/DiscoJuice authentication
- Custom AAI files and configuration
- CLARIN-DK branding and documentation
- Production configuration (docker/.env, config.prod.yml)
- Custom entity ID and IdP setup

**Pulling UFAL's images would overwrite all these customizations.**

You must build your own images with your customizations baked in.

---

### Strategy 3: Build Locally, Deploy to Production

**Impact:** Use your local dev machine's CPU cores for building

**Workflow:**
```bash
# On local machine (with more CPU cores)
cd /opt/dspace7/frontend
git pull origin optimize-docker-build

# Build locally with BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker build -t dspace-angular:local-build .

# Save and transfer image
docker save dspace-angular:local-build | gzip > dspace-angular-local.tar.gz
scp dspace-angular-local.tar.gz clarinrepo01fl:/tmp/

# On production server
ssh clarinrepo01fl
docker load < /tmp/dspace-angular-local.tar.gz
docker tag dspace-angular:local-build ufal/dspace-angular:dspace-7_x

# Deploy
cd /opt/dspace7/frontend/docker
docker compose up -d dspace-angular
```

**Pros:**
- Fast builds on multi-core machine
- Full control over customization
- Works with current infrastructure

**Cons:**
- Manual workflow
- Image transfer overhead
- Requires good local machine

**Alternative: Use Docker registry**
```bash
# Local machine - push to registry (e.g., Docker Hub, GitHub Registry)
docker tag dspace-angular:local-build your-registry/dspace-angular:custom
docker push your-registry/dspace-angular:custom

# Production - pull from registry
docker pull your-registry/dspace-angular:custom
docker tag your-registry/dspace-angular:custom ufal/dspace-angular:dspace-7_x
```

---

### Strategy 4: Incremental Builds with Cache Mounts

**Impact:** Second and subsequent builds faster (if dependencies unchanged)

**Already implemented:** Multi-stage Dockerfile uses BuildKit cache mounts

**How it works:**
- First build: Full 82 minutes (on 1-core machine)
- Subsequent builds (source changes only): ~82 minutes (build stage re-runs)
- Subsequent builds (no source changes): ~2 minutes (uses cached layers)

**Limitation:** On 1-core machine, any source change still triggers 82-min build.

**Commands:**
```bash
cd /opt/dspace7/frontend/docker

# First build (creates cache)
docker compose build dspace-angular

# Change only source files → still 82 min
# Change only package.json → ~12 min (yarn install) + 82 min (build)
# Change only README.md → ~2 min (cache hit)
```

---

### Strategy 5: Remote Build Service

**Impact:** Offload builds to cloud service

**Options:**
- GitHub Actions with self-hosted runner
- Docker Hub automated builds
- CI/CD pipeline on separate build server

**Example GitHub Actions:**
```yaml
name: Build DSpace Angular
on:
  push:
    branches: [optimize-docker-build]

jobs:
  build:
    runs-on: ubuntu-latest  # GitHub provides multi-core runners
    steps:
      - uses: actions/checkout@v3
      - name: Build and push
        run: |
          docker build -t ghcr.io/your-org/dspace-angular:latest .
          docker push ghcr.io/your-org/dspace-angular:latest
```

**Pros:**
- Automated
- Fast builds (GitHub runners have multiple cores)
- Version controlled

**Cons:**
- Setup complexity
- Requires CI/CD infrastructure
- May need private registry

---

## Benchmark: Local vs Production Build

**To test local build speed:**

```bash
# On your local dev machine
cd /path/to/dspace7/frontend
git checkout optimize-docker-build

# Ensure BuildKit is enabled
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Time the build
time docker build -t dspace-angular:test .

# Check your machine specs for comparison
nproc  # CPU cores
free -h  # RAM
```

**Expected results (if you have 4+ cores):**
- `yarn install`: 8-12 minutes
- `yarn build:prod`: 15-25 minutes
- **Total: 25-35 minutes**

**This will confirm whether CPU cores are the bottleneck.**

---

## Current Dockerfile vs Previous

### Previous (Single-Stage):
```dockerfile
FROM node:18-alpine
COPY package.json yarn.lock ./
RUN yarn install
COPY . ./                    # ← Invalidates all subsequent layers
RUN yarn build:prod          # ← Runs every time
CMD pm2-runtime start
```

**Problem:** Every code change invalidates the build layer, forcing full rebuild.

### Current (Multi-Stage):
```dockerfile
# Stage 1: Dependencies (cached unless package.json changes)
FROM node:18-alpine AS dependencies
COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install

# Stage 2: Build (cached unless source changes)
FROM dependencies AS builder
COPY . ./
RUN yarn build:prod

# Stage 3: Runtime (minimal image, only runtime files)
FROM node:18-alpine AS runtime
COPY --from=builder /app/dist ./dist
COPY --from=dependencies /app/node_modules ./node_modules
CMD pm2-runtime start
```

**Improvement:** Layers are cached independently, smaller final image.

**Limitation on 1-core machine:** Build stage still takes 82 min when source changes.

---

## Quick Reference Commands

### Build in detached tmux (survives SSH disconnect)
```bash
cd /opt/dspace7/frontend/docker
tmux new-session -d -s docker-build \
  "time docker compose build dspace-angular 2>&1 | tee /tmp/build-$(date +%Y%m%d-%H%M%S).log"

# Monitor progress
tmux attach -t docker-build  # Ctrl+B then D to detach

# Check log
tail -f /tmp/build-*.log
```

### Build only frontend (not backend)
```bash
cd /opt/dspace7/frontend/docker
docker compose -f docker-compose.yml build dspace-angular
docker compose -f docker-compose.yml up -d dspace-angular
```

### Pull instead of build
```bash
cd /opt/dspace7/frontend/docker
docker compose pull dspace-angular
docker compose up -d dspace-angular
```

### Check build cache
```bash
docker system df -v  # Show cache usage
docker builder prune  # Clean build cache (use with caution)
```

---

## Recommendations

### Immediate Actions:
1. ✅ **Test local build** to confirm CPU bottleneck (Benchmark section)
2. ⏳ **Request more CPU cores** for production VM (Strategy 1)
3. 📝 **Set up local build workflow** as interim solution (Strategy 3)

### Short-term (while waiting for more cores):
- Build locally on multi-core machine and transfer images (Strategy 3)
- Only rebuild when absolutely necessary
- Use in-place edits (docker cp) for AAI file changes to avoid rebuilds

### Long-term (with 4+ cores):
- Multi-stage Dockerfile will provide good caching
- Builds will be 15-25 minutes instead of 82 minutes
- Normal development workflow becomes viable

---

## Next Steps

1. **Test local build speed** to confirm hypothesis
2. **Request VM resize** to 4-6 CPU cores
3. **Document local build → production deploy workflow** if needed as interim solution
4. **Consider CI/CD pipeline** if frequent builds are needed

---

## Notes

- Current tmux session: `docker-build-test` (can reconnect with `tmux attach -t docker-build-test`)
- Build log: `/tmp/docker-build-20260206-093733.log`
- This branch (`optimize-docker-build`) has optimized Dockerfile ready to merge
- The optimizations help but don't solve the 1-core bottleneck
