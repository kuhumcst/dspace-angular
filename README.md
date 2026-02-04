dspace-angular
==============

> The DSpace User Interface built on [Angular](https://angular.io/), written in [TypeScript](https://www.typescriptlang.org/) and using [Angular Universal](https://angular.io/guide/universal).

Overview
--------

This is a fork of https://github.com/DSpace/dspace-angular modified to function as a frontend for [clarin-dspace](https://github.com/ufal/clarin-dspace/tree/clarin-v7). Please refer to [Installation Wiki](https://github.com/ufal/clarin-dspace/wiki/NewInstallation) or the [clarin-dspace v7 wiki](https://github.com/ufal/clarin-dspace/wiki/NewHome) 


CLARIN-DK setup
===============

> NOTE: this is the appended setup guide for CLARIN-DK's DSpace repository.

- The new main repo of the CLARIN DSpace is now the **frontend** repo (`dspace-angular`), _not_ the backend one (`clarin-dspace`).
- The branch which contains our **downstream** changes is called `clarin-dk-v7`.
  - Consider this the *de facto* master/main branch.
  - It contains *just enough* changes to make running a CLARIN-DK DSpace Docker setup possible in our dev/prod environments.
  - It needs to be regularly **rebased** on the stable branch of the CLARIN DSpace v7 fork (the one maintained by ufal).
    - When rebasing, expect occasional merge conflicts for this README.md (as well as other files touched in the meantime).
- The [previous CLARIN DSpace repo](https://github.com/kuhumcst/clarin-dspace) had a branch which contained downstream changes called `clarin-dk-ucph`, though that was for the older v5 of DSpace.


Deviations from upstream
------------------------

- The `.gitignore` of this repo has `.env` added to it, so we use `.env.local` as our primary .env file.
- S3 support has been explicitly disabled in `docker/local.cfg`.
- The handle server has been configured in `docker/local.cfg` with our handle prefix: `handle.additional.prefixes = 20.500.12115`.

Shibboleth SP (dual v5/v7 setup)
---------------------------------

The Shibboleth SP runs on the **host** (`/etc/shibboleth/`), not inside any
Docker container. Both DSpace v5 (`repository.clarin.dk`) and v7
(`dspace.clarin.dk`) share a single SP with one entity ID registered in the
CLARIN federation:

```
entityID = https://repository.clarin.dk/shibboleth
```

`shibboleth2.xml` routes the two instances via `RequestMapper` + `ApplicationOverride`:

| Host | applicationId | Default ACS index | ACS endpoint |
|------|--------------|-------------------|--------------|
| `repository.clarin.dk` | `default` | 1 | `https://repository.clarin.dk/Shibboleth.sso/SAML2/POST` |
| `dspace.clarin.dk` | `dspace7` | 5 | `https://dspace.clarin.dk/Shibboleth.sso/SAML2/POST` |

Both sets of ACS endpoints are declared in the metadata template
(`repository.clarin.dk.template.metadata.xml`) and in the federation metadata
at `https://infra.clarin.eu/aai/prod_md_about_spf_sps.xml`.

**Do not change the entity ID** without coordinating with the CLARIN federation
— it must match what is registered there. If login fails with "Issuer is not
among trusted", the problem is likely on the IdP side; verify against the
federation metadata before touching the SP config.

Config changes take effect on `sudo systemctl restart shibd` — no Docker
rebuild needed.

Migrations
----------
The v5 to v7 migration uses code from a [separate repo](https://github.com/ufal/dspace-migrate). High-level process:

1. Clone migration tool and install dependencies
2. Start fresh v7 DSpace instance
3. Load v5 database dumps into Postgres container
4. Transfer v5 assetstore files (required for complete migration)
5. Configure migration tool (`project_settings.py`)
6. Run migration via REST API

**Important:** Migration must be performed with full assetstore access. Post-migration file addition doesn't work.

For detailed step-by-step instructions, see https://github.com/kuhumcst/dspace-v7-data

### Troubleshooting: Handle Conflicts

**Symptoms**: `POST [core/communities] failed. Exception: [<Response [500]>]`, backend logs show "handle already in use", 0 items imported.

**Cause**: Migration tool uses cache in `src/__temp/resume/`. After `docker compose down -v`, cached UUIDs are stale.

**Solution**:
```bash
# Reset everything
cd /path/to/dspace-angular
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml down -v
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml up -d --pull always
docker logs -f dspace0  # Wait for startup

# Recreate admin
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml -f docker/cli.yml run --rm dspace-cli create-administrator -e test@test.edu -f Test -l Admin -p password -c en -o Test

# Reload v5 databases
docker exec dspacedb0 createdb -U dspace -p 5430 clarin-dspace
docker exec dspacedb0 createdb -U dspace -p 5430 clarin-utilities
cat /path/to/clarin-dspace.sql | docker exec -i dspacedb0 psql -U dspace -p 5430 clarin-dspace
cat /path/to/clarin-utilities.sql | docker exec -i dspacedb0 psql -U dspace -p 5430 clarin-utilities

# Delete cache and re-run
cd /path/to/dspace-migrate
rm -rf src/__temp/resume/
source .venv/bin/activate
cd src
python repo_import.py --resume False
```

**Verification**: Should see `OK Imported [ 1] communities`, `OK Imported [ 2] collections` in logs.

**Best practice**: Always clean cache (`rm -rf src/__temp/resume/`) and use `--resume False` when restarting from scratch.


## Commands

### Docker

```bash
# Start CLARIN-DSpace v7 locally
#   --env-file .env.local    Use our local environment config
#   -p dspace-test           Project name (prefixes container names)
#   -f docker/docker-...     Compose files for frontend and backend
#   -d                       Run in background (detached)
#   --pull always            Always fetch latest images before starting
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml up -d --pull always

# Restart (e.g. after config changes)
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml down
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml up -d

# Full reset (wipes all data)
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml down -v
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml up -d --pull always

# View backend logs
docker logs -f dspace0

# Run DSpace CLI commands
docker compose --env-file .env.local -p dspace-test -f docker/docker-compose.yml -f docker/docker-compose-rest.yml -f docker/cli.yml run --rm dspace-cli <command>
```

### Git

```bash
# Pull in new upstream changes from UFAL (to rebase on)
git fetch upstream
```

Production update workflow
--------------------------

The production deployment (`clarinrepo01fl`) runs as two separate Compose
projects from `docker/`. Both use `docker/.env` (auto-loaded, `INSTANCE=1`).

> **Important:** Always pass `-f` explicitly. The override file references
> backend services, so plain `docker compose` without `-f` will fail.

| Project | Services | Command prefix |
|---------|----------|----------------|
| `d7` (backend) | dspace, dspacedb, dspacesolr | `docker compose -p d7 -f docker-compose-rest.yml -f docker-compose.override.yml` |
| `docker` (frontend) | dspace-angular | `docker compose -f docker-compose.yml` |

### What requires a rebuild vs a restart

| Change | Action needed |
|--------|--------------|
| `docker/local.cfg` | Restart `dspace` only — it's a bind mount |
| Source code in `src/` | Frontend rebuild (~20 min) |
| `package.json` / `yarn.lock` | Frontend rebuild, `yarn install` also re-runs (~30 min total) |
| `Dockerfile` | Frontend rebuild, no layer cache available |

### In-place edits (bypass the rebuild)

The AAI files (`aai.js`, `aai_config.js`, `discojuice/discojuice.js` under
`src/aai/`) are plain JS — never compiled by Angular — and can be pushed
live with `docker cp`, no restart needed.  Anything under `src/app/` or
`src/themes/` requires a full rebuild.

**Each file exists at three paths in the container (`dist/browser/`,
`dist/server/`, `src/`); SSR and the browser client each read a different one,
so all three must be updated.**  `discojuice.js` additionally ships `.gz`/`.br`
companions in `dist/browser/` that nginx picks from — regenerate them after
every edit.  **The container has no `brotli` CLI; use Node's built-in `zlib`**
(the `node -e` command below).  `aai.js` and `aai_config.js` have no
compressed copies.

```bash
# aai.js (repeat pattern for aai_config.js as needed)
docker cp src/aai/aai.js                    dspace-angular1:/app/dist/browser/aai.js
docker cp src/aai/aai.js                    dspace-angular1:/app/dist/server/aai.js
docker cp src/aai/aai.js                    dspace-angular1:/app/src/aai/aai.js

# discojuice.js + regenerate .gz/.br
docker cp src/aai/discojuice/discojuice.js  dspace-angular1:/app/dist/browser/discojuice.js
docker cp src/aai/discojuice/discojuice.js  dspace-angular1:/app/dist/server/discojuice.js
docker cp src/aai/discojuice/discojuice.js  dspace-angular1:/app/src/aai/discojuice/discojuice.js
docker exec dspace-angular1 node -e "
const fs = require('fs'), zlib = require('zlib');
const src = fs.readFileSync('/app/dist/browser/discojuice.js');
fs.writeFileSync('/app/dist/browser/discojuice.js.gz',  zlib.gzipSync(src));
fs.writeFileSync('/app/dist/browser/discojuice.js.br',  zlib.brotliCompressSync(src));"
```

> **Ephemeral:** edits vanish on container recreate/rebuild.  Commit source
> changes to `clarin-dk-v7` so the next build picks them up.

### Rebase + rebuild

```bash
cd /opt/dspace7/frontend

# 1. Rebase onto upstream (add remote first if missing)
git remote add upstream https://github.com/ufal/dspace-angular.git  # if needed
git fetch upstream
git rebase upstream/clarin-v7
# → resolve any conflicts, then: git rebase --continue

# 2. Rebuild frontend
cd docker
docker compose -f docker-compose.yml up -d --build

# 3. Restart backend (only if local.cfg changed)
docker compose -p d7 -f docker-compose-rest.yml -f docker-compose.override.yml restart dspace

# 4. Verify both are healthy
curl -s http://127.0.0.1:8081/server/api | head -5           # backend
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4001 # frontend → 200

# 5. Push (force required — rebase rewrites history)
cd /opt/dspace7/frontend
git push --force-with-lease origin clarin-dk-v7
```

To amend a missed change into the latest commit instead of rebasing:
`git add <file> && git commit --amend --no-edit`, rebuild/restart as needed,
then push the same way.

### Build times and caching

| Stage | Time |
|-------|------|
| `yarn install` | ~10–12 min (skipped if `package.json`/`yarn.lock` unchanged) |
| Angular AOT + SSR (`yarn build:prod`) | ~18–20 min (always runs on source changes) |
| Backend (`dspace`) restart | ~6 min |

`yarn install` is cached as long as dependency manifests haven't changed — a
typical rebase that only touches `src/` will skip it entirely. The Angular
build produces no output during AOT compilation, so a long silence after the
initial module-resolution warnings is normal, not a hang.

### Full teardown (both projects)

Only needed if something is seriously wrong or the Compose config itself
changed. Volumes are preserved — no data loss.

```bash
cd /opt/dspace7/frontend/docker
docker compose -p d7 -f docker-compose-rest.yml -f docker-compose.override.yml down
docker compose -f docker-compose.yml down
docker compose -p d7 -f docker-compose-rest.yml -f docker-compose.override.yml up -d
docker compose -f docker-compose.yml up -d --build
```


Resource use
------------

This version of CLARIN DSpace is more resource hungry. Recommended setup:

- CPUs: 4 cores minimum, 6+ if you can spare them (the Angular build is parallelized)
- Memory: 6-8GB
- Swap: 1-2GB

> NOTE: for Apple Silicon Macs, Rosetta emulation needs to be enabled as the CLARIN DSpace Docker images are built for x86. Set `DOCKER_DEFAULT_PLATFORM=linux/amd64` in your `.env.local`.