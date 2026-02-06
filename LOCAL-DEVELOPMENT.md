# Local Development Setup Guide

**Branch:** `clarin-dk-v7` (or any development branch)
**Last Updated:** 2026-02-06
**For:** DSpace Angular Frontend (CLARIN-DK Fork)

---

## Quick Start

The fastest way to get a fully working local environment with hot reloading:

```bash
# 1. Start the backend services (DSpace REST API + database + Solr)
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml up -d

# 2. Wait for backend to be ready (~2-3 minutes)
docker logs -f dspace0  # Watch for "Server startup in X milliseconds"
# Press Ctrl+C to stop watching logs once ready

# 3. Run the Angular dev server (with hot reloading)
yarn install  # First time only, or after package.json changes
yarn start:dev
```

The frontend will be available at **http://localhost:4000** with hot reloading enabled.

Any changes you make to files in `src/` will automatically trigger a rebuild and refresh your browser.

---

## Architecture Overview

### What Runs Where

**Backend (runs in Docker containers):**
- `dspace` - DSpace REST API at `http://localhost:8080/server`
- `dspacedb` - PostgreSQL database
- `dspacesolr` - Apache Solr search engine

**Frontend (runs locally on your machine):**
- Angular development server with hot reloading
- Node.js process serving at `http://localhost:4000`
- Connects to the Dockerized backend REST API

This hybrid approach gives you:
- ✅ Fast backend setup (no Java compilation needed)
- ✅ Instant frontend hot reloading
- ✅ Full debugging capabilities
- ✅ Real backend with database and search

---

## Prerequisites

### Required Software

- **Node.js 18.x** (check with `node -v`)
- **Yarn** (check with `yarn -v`)
- **Docker Desktop** (for backend services)

### Apple Silicon (M1/M2/M3) Users

Your `.env.local` already has the correct configuration:
```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64
```

This forces Docker to run x86 images via Rosetta emulation since no ARM64 builds are available.

---

## Configuration Files

### `.env.local` (Current Setup)

Your environment is configured as:
```bash
INSTANCE=0                           # Instance identifier
DSPACE_HOST=localhost                # Local development
DSPACE_SSL=false                     # No SSL for localhost
DSPACE_REST_PORT=8080                # Backend API port
UI_PORT=4000                         # Frontend dev server port
DOCKER_DEFAULT_PLATFORM=linux/amd64  # x86 emulation for Apple Silicon
FE_CMD=yarn start:dev                # Development mode with hot reload
```

### `config/config.dev.yml` (Tracked in Git)

This file is included in the repo (force-added via `git add -f`) with development-friendly settings:

```yaml
debug: true                  # Logs Redux actions and state changes
cache.msToLive.default: 60s  # Shorter cache (vs 15 min in production)
serverSide.botCache.max: 0   # Disabled for faster development
serverSide.anonymousCache.max: 0  # Always see fresh content
```

**Note:** Environment variables from `.env.local` automatically override these settings, so you typically don't need to modify this file unless you want to change development-specific behavior.

---

## First-Time Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Start Backend Services

```bash
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml up -d --pull always
```

The `--pull always` ensures you have the latest images from UFAL.

### 3. Wait for Backend Initialization

```bash
# Watch logs until you see "Server startup in X milliseconds"
docker logs -f dspace0

# Or check if API is responding
curl http://localhost:8080/server/api
```

First startup takes ~2-3 minutes while the database initializes.

### 4. Create Admin User

```bash
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml \
  -f docker/cli.yml run --rm dspace-cli \
  create-administrator -e admin@test.edu -f Admin -l User -p admin -c en
```

**Credentials:** `admin@test.edu` / `admin`

### 5. Start Frontend Dev Server

```bash
yarn start:dev
```

Visit **http://localhost:4000** in your browser.

---

## Development Workflow

### Daily Development

```bash
# Terminal 1: Backend (start once, leave running)
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml up

# Terminal 2: Frontend (restart as needed)
yarn start:dev
```

### Making Changes

| What Changed | What To Do |
|--------------|------------|
| Files in `src/app/`, `src/themes/` | Nothing! Hot reload handles it |
| `config/config.dev.yml` | Restart `yarn start:dev` |
| `package.json` | Run `yarn install`, then restart dev server |
| `docker/local.cfg` (backend) | `docker restart dspace0` (no rebuild) |
| Backend source code | Requires full backend rebuild (rare) |

### Testing Your Changes

```bash
# Run tests once
yarn test

# Run tests in watch mode (re-runs on file changes)
yarn test:watch

# Run linter
yarn lint

# Auto-fix linting issues
yarn lint-fix
```

---

## Available Commands

From `package.json`:

| Command | Purpose |
|---------|---------|
| `yarn start:dev` | **Development server with hot reloading** ⭐ |
| `yarn build` | Development build (no SSR) |
| `yarn build:prod` | Production build with SSR (takes 15-25 min locally) |
| `yarn test` | Run unit tests once |
| `yarn test:watch` | Run tests in watch mode |
| `yarn lint` | Check code style |
| `yarn lint-fix` | Auto-fix linting issues |
| `yarn clean:cli` | Clear Angular cache |
| `yarn sync-i18n` | Sync translation files after editing `en.json5` |

---

## Docker Management

### View Logs

```bash
# Backend API logs
docker logs -f dspace0

# Database logs
docker logs -f dspacedb0

# Solr logs
docker logs -f dspacesolr0

# All services
docker compose --env-file .env.local -p dspace-test logs -f
```

### Stop Services

```bash
# Stop (preserves data)
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml down

# Stop and remove volumes (full reset)
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml down -v
```

### Restart After Backend Config Changes

```bash
# Restart just the backend API
docker restart dspace0

# Or restart all services
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml restart
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 4000 (frontend)
lsof -ti:4000 | xargs kill -9

# Find what's using port 8080 (backend)
lsof -ti:8080 | xargs kill -9
```

### Backend Not Responding

```bash
# Check if API is accessible
curl http://localhost:8080/server/api

# Check backend logs
docker logs dspace0 --tail 100

# Restart backend
docker restart dspace0
```

### Hot Reload Not Working

```bash
# Clear Angular cache
yarn clean:cli

# Restart dev server
# Press Ctrl+C to stop, then:
yarn start:dev
```

### Database Issues

```bash
# Full reset (WARNING: deletes all data)
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml down -v

# Start fresh
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml up -d --pull always

# Recreate admin user
docker compose --env-file .env.local -p dspace-test \
  -f docker/docker-compose.yml \
  -f docker/docker-compose-rest.yml \
  -f docker/cli.yml run --rm dspace-cli \
  create-administrator -e admin@test.edu -f Admin -l User -p admin -c en
```

### Angular Build Errors

```bash
# Clear everything and start fresh
yarn clean:cli
rm -rf node_modules
yarn install
yarn start:dev
```

---

## Key Differences: Development vs Production

| Aspect | Local Development | Production |
|--------|------------------|------------|
| **Frontend** | Runs with `yarn start:dev` on your machine | Built into Docker image |
| **Hot reload** | ✅ Enabled | ❌ Not applicable |
| **Build time** | Instant startup | 15-25 min (your 8-core machine), 82 min (1-core prod server) |
| **SSR** | Disabled for faster development | Fully enabled |
| **Authentication** | Not required | Shibboleth SP on host |
| **Backend** | UFAL's pre-built Docker image | Same (backend is shared) |

---

## Authentication Note

**You don't need Shibboleth authentication for local development!**

The production environment uses Shibboleth SP running on the host machine (not in Docker), but for local development you can:
- Use the admin account created above
- Register new users via the frontend
- Test without federated authentication

---

## Project Structure

Key directories for development:

```
src/
├── app/              # Angular components, services, modules
├── themes/           # Theme customizations (CLARIN-DK specific)
├── assets/           # Static assets, translations
│   └── i18n/        # Translation files (*.json5)
├── config/          # TypeScript config files
└── aai/             # CLARIN-DK authentication files (AAI, DiscoJuice)

config/              # YAML configuration files
├── config.yml       # Default configuration
├── config.dev.yml   # Development overrides (create this)
└── config.prod.yml  # Production configuration

docker/              # Docker Compose files and configs
├── docker-compose.yml       # Frontend service
├── docker-compose-rest.yml  # Backend services
└── local.cfg               # Backend configuration
```

---

## Translation Workflow

When you modify English translations:

```bash
# Edit the English source file
vim src/assets/i18n/en.json5

# Sync changes to other language files
yarn sync-i18n
```

This propagates changes to all other `*.json5` files in `src/assets/i18n/`.

---

## Generating New Components

Use Angular CLI through yarn:

```bash
# Generate a new component
yarn ng generate component my-component

# Generate a service
yarn ng generate service my-service

# Generate a module
yarn ng generate module my-module
```

---

## Debugging Tips

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Source maps are enabled by default in dev mode
3. Set breakpoints directly in TypeScript source

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome against localhost",
      "url": "http://localhost:4000",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

### Console Debugging

```javascript
// In browser console, to pause execution after 5 seconds:
setTimeout(() => { debugger; }, 5000);
```

---

## Resources

- **CLARIN-DSpace Wiki:** https://github.com/ufal/clarin-dspace/wiki/NewHome
- **Installation Guide:** https://github.com/ufal/clarin-dspace/wiki/NewInstallation
- **Frontend Development:** https://github.com/ufal/clarin-dspace/wiki/Developing-frontend
- **DSpace 7 Documentation:** https://wiki.lyrasis.org/display/DSDOC7x
- **Angular Documentation:** https://angular.io/docs

---

## Need Help?

Check the wiki first, then:
1. Review Docker logs: `docker logs dspace0`
2. Check backend API: `curl http://localhost:8080/server/api`
3. Clear caches: `yarn clean:cli`
4. Full reset: Stop services with `-v` flag and restart

---

## Next Steps

Once you have the dev environment running:

1. **Explore the codebase** - Start with `src/app/app.component.ts`
2. **Make a small change** - Edit a component and watch hot reload work
3. **Run the tests** - Try `yarn test:watch`
4. **Read the wiki** - Especially the "Developing frontend" page
5. **Check CLARIN-DK customizations** - Look in `src/themes/` and `src/aai/`

Happy coding! 🚀
