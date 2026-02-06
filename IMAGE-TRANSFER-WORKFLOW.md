# Image Transfer Workflow: Local Build → Production Deploy

**Purpose:** Build Docker images on your local machine (8 cores, fast) and deploy them to production (1 core, slow)
**Build time savings:** 8 minutes locally vs 82 minutes on production server
**Last updated:** 2026-02-06

---

## Overview

This workflow allows you to:
1. Build the Docker image on your fast local machine (8m 47s)
2. Transfer the image to production via Docker registry or direct file transfer
3. Deploy on production without rebuilding

**When to use this:**
- You need to deploy changes quickly
- You're waiting for production server CPU upgrade
- You want to avoid tying up production resources

---

## Prerequisites

- Docker running on your local machine
- SSH access to production server (`clarinrepo01fl`)
- Git branch with your changes pushed to remote

---

## Method 1: Docker Registry (Recommended)

This is the cleanest approach and works best for ongoing deployments.

### Option A: GitHub Container Registry (Free, Private)

**Setup (one-time):**

```bash
# 1. Create a GitHub Personal Access Token (PAT)
# Go to: https://github.com/settings/tokens
# Create token with 'write:packages' scope
# Save the token securely!

# 2. Login to GitHub Container Registry
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 3. On production server, do the same
ssh clarinrepo01fl
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**Build and Push (on your laptop):**

```bash
# 1. Ensure you're on the right branch
cd /Users/simongray/Code/dspace-angular
git status  # Confirm your branch

# 2. Build and tag the image
export DOCKER_BUILDKIT=1
docker build -t ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7 .

# Or tag an existing image
docker tag dspace-angular:test ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7

# 3. Push to registry
docker push ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7

# Optional: Tag with a version/date
docker tag ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7 \
  ghcr.io/kuhumcst/dspace-angular:2026-02-06
docker push ghcr.io/kuhumcst/dspace-angular:2026-02-06
```

**Deploy (on production):**

```bash
ssh clarinrepo01fl
cd /opt/dspace7/frontend

# 1. Pull the new image
docker pull ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7

# 2. Tag it with the expected name
docker tag ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7 ufal/dspace-angular:dspace-7_x

# 3. Restart the frontend service
cd docker
docker compose -f docker-compose.yml restart dspace-angular

# Or force recreate:
docker compose -f docker-compose.yml up -d dspace-angular
```

### Option B: Docker Hub (Public or Paid)

Similar to GitHub, but uses `docker.io`:

```bash
# Login
docker login

# Tag and push
docker tag dspace-angular:test your-dockerhub-username/dspace-angular:clarin-dk-v7
docker push your-dockerhub-username/dspace-angular:clarin-dk-v7

# On production
docker pull your-dockerhub-username/dspace-angular:clarin-dk-v7
docker tag your-dockerhub-username/dspace-angular:clarin-dk-v7 ufal/dspace-angular:dspace-7_x
```

---

## Method 2: Direct File Transfer

Good for one-off deploys or when registry setup isn't feasible.

### Via scp (Standard)

**On your laptop:**

```bash
cd /Users/simongray/Code/dspace-angular

# 1. Save the image to a tar.gz file
docker save dspace-angular:test | gzip > dspace-angular-$(date +%Y%m%d).tar.gz

# Example filename: dspace-angular-20260206.tar.gz
# Size: ~1.5GB compressed (may take a few minutes)

# 2. Transfer to production
scp dspace-angular-20260206.tar.gz clarinrepo01fl:/tmp/

# Transfer time depends on your connection (~5-15 minutes for 1.5GB)
```

**On production:**

```bash
ssh clarinrepo01fl

# 1. Load the image
docker load < /tmp/dspace-angular-20260206.tar.gz

# 2. Tag it correctly
docker tag dspace-angular:test ufal/dspace-angular:dspace-7_x

# 3. Clean up the tar file
rm /tmp/dspace-angular-20260206.tar.gz

# 4. Restart the service
cd /opt/dspace7/frontend/docker
docker compose -f docker-compose.yml up -d dspace-angular

# 5. Verify it's running
docker ps | grep dspace-angular
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4001  # Should return 200
```

### Via rsync (Faster for repeat transfers)

```bash
# Initial transfer
rsync -avz --progress dspace-angular-20260206.tar.gz clarinrepo01fl:/tmp/

# Rsync is faster if you need to retry interrupted transfers
```

---

## Method 3: Git + Remote Build (Fallback)

If image transfer fails, you can still trigger a remote build with a clean checkout:

```bash
ssh clarinrepo01fl
cd /opt/dspace7/frontend

# Pull latest changes
git fetch origin
git checkout optimize-docker-build  # or your branch
git pull origin optimize-docker-build

# Start build in tmux (so it survives SSH disconnect)
cd docker
tmux new-session -d -s docker-build \
  "time docker compose -f docker-compose.yml build dspace-angular 2>&1 | tee /tmp/build-$(date +%Y%m%d-%H%M%S).log"

# Monitor progress
tmux attach -t docker-build  # Ctrl+B then D to detach

# After completion (82 minutes)
docker compose -f docker-compose.yml up -d dspace-angular
```

---

## Complete Deployment Checklist

Use this checklist for each deployment:

### Pre-Deployment

- [ ] Code changes tested locally
- [ ] Changes committed and pushed to Git
- [ ] Branch noted: `________________`
- [ ] Build completed successfully locally
- [ ] Image tagged correctly

### Build & Transfer

- [ ] Image built on local machine (8-9 minutes)
- [ ] Image pushed to registry OR saved to tar.gz
- [ ] Image transferred to production (if using file transfer)

### Production Deployment

- [ ] SSH into production server
- [ ] Pull/load the new image
- [ ] Tag image as `ufal/dspace-angular:dspace-7_x`
- [ ] Pull latest code changes (for git history)
  ```bash
  cd /opt/dspace7/frontend
  git fetch origin
  git checkout your-branch
  git pull origin your-branch
  ```
- [ ] Restart frontend service
- [ ] Verify service is running
  ```bash
  docker ps | grep dspace-angular
  curl http://127.0.0.1:4001
  ```
- [ ] Check logs for errors
  ```bash
  docker logs -f dspace-angular1
  ```
- [ ] Test in browser: https://dspace.clarin.dk

### Post-Deployment

- [ ] Verify key functionality works
- [ ] Check browser console for errors
- [ ] Monitor logs for 5-10 minutes
- [ ] Update deployment notes/changelog
- [ ] Clean up old images on production (if needed)
  ```bash
  docker images | grep dspace-angular
  docker image prune -a  # Remove unused images
  ```

---

## Troubleshooting

### Image Transfer Failed

```bash
# Check disk space on production
ssh clarinrepo01fl df -h /tmp

# Check image size
ls -lh dspace-angular-*.tar.gz

# If transfer interrupted, resume with rsync
rsync -avz --partial --progress dspace-angular-*.tar.gz clarinrepo01fl:/tmp/
```

### Image Load Failed

```bash
# Verify tar file integrity
gzip -t dspace-angular-*.tar.gz

# Try uncompressed transfer if gzip is corrupted
docker save dspace-angular:test > dspace-angular.tar  # No compression
scp dspace-angular.tar clarinrepo01fl:/tmp/
```

### Service Won't Start

```bash
# Check if image is loaded
docker images | grep dspace-angular

# Check if old container is stuck
docker ps -a | grep dspace-angular
docker rm -f dspace-angular1  # Force remove

# Check logs
docker logs dspace-angular1

# Try recreating
cd /opt/dspace7/frontend/docker
docker compose -f docker-compose.yml up -d --force-recreate dspace-angular
```

### Wrong Image Running

```bash
# Verify image ID
docker images ufal/dspace-angular:dspace-7_x

# Check what container is using
docker inspect dspace-angular1 | grep Image

# Force pull fresh image
docker compose -f docker-compose.yml pull dspace-angular
docker compose -f docker-compose.yml up -d dspace-angular
```

---

## Build Time Comparison

| Method | Local Machine | Production Server | Speedup |
|--------|--------------|-------------------|---------|
| **Build** | 8m 47s | 82 minutes | **9.3x faster** |
| **Transfer** | ~10 minutes | N/A | N/A |
| **Total** | ~19 minutes | 82 minutes | **4.3x faster** |

Even with transfer time, building locally is still over 4x faster!

---

## Registry Recommendations

For ongoing development, **GitHub Container Registry** is recommended:

**Pros:**
- Free for public and private repos
- Integrated with GitHub
- Good performance
- No rate limits for authenticated users
- Version tagging built-in

**Setup time:** 10 minutes one-time setup
**Per-deploy time:** 5-10 minutes (build locally, push, pull on prod)

---

## Advanced: Automated CI/CD

For frequent deployments, consider GitHub Actions:

```yaml
# .github/workflows/build-and-push.yml
name: Build and Push Docker Image

on:
  push:
    branches: [clarin-dk-v7, optimize-docker-build]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ghcr.io/kuhumcst/dspace-angular:clarin-dk-v7
```

This automatically builds and pushes on every git push. Production only needs to pull the latest image.

---

## Notes

- **Image size:** ~1.5GB compressed, ~4.2GB uncompressed
- **Network:** Consider production server's bandwidth when choosing transfer method
- **Disk space:** Ensure production has ~10GB free for multiple image versions
- **Rollback:** Always keep previous image tagged for quick rollback
  ```bash
  # Before deploying new image
  docker tag ufal/dspace-angular:dspace-7_x ufal/dspace-angular:backup-$(date +%Y%m%d)
  ```

---

## Next Steps

1. **Choose a transfer method** (Registry recommended for ongoing use)
2. **Test the workflow** with this build
3. **Document any production-specific steps** in your internal docs
4. **Request CPU upgrade** for production server (long-term solution)

Once production has 4-6 CPU cores, you can build directly on the server in 15-25 minutes, making this workflow optional for urgent deploys only.
