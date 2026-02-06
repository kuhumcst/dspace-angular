# Multi-stage Dockerfile for DSpace Angular
# Optimized for faster builds with better layer caching

# ============================================================================
# Stage 1: Dependencies
# This stage is cached unless package.json or yarn.lock changes
# ============================================================================
FROM node:18-alpine AS dependencies

# Install build tools needed for native module compilation
RUN apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only dependency manifests to maximize cache hits
COPY package.json yarn.lock ./

# Install dependencies with BuildKit cache mount for faster reinstalls
# Cache mount persists node_modules across builds when dependencies haven't changed
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --network-timeout 300000

# ============================================================================
# Stage 2: Build
# This stage runs the Angular production build
# ============================================================================
FROM dependencies AS builder

WORKDIR /app

# Copy source code (build stage is cached unless source changes)
COPY . ./

# Set Node memory limit for build
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Run production build
# This is where most build time is spent (~18-20 min)
RUN yarn build:prod

# ============================================================================
# Stage 3: Runtime
# This stage creates the minimal production image
# ============================================================================
FROM node:18-alpine AS runtime

# Install timezone data and PM2 process manager
RUN apk add --no-cache tzdata && \
    npm install -g pm2 && \
    rm -rf /root/.npm

WORKDIR /app

# Copy package.json for metadata (used by PM2)
COPY package.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docker ./docker
COPY --from=builder /app/server.ts ./server.ts

# Copy node_modules from dependencies stage (includes production deps)
COPY --from=dependencies /app/node_modules ./node_modules

# Expose port
EXPOSE 4000

# Set production environment
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Start application with PM2
CMD ["/bin/sh", "-c", "pm2-runtime start docker/dspace-ui.json > /dev/null 2> /dev/null"]
