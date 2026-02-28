# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
WORKDIR /app/packages/core
RUN npm ci
COPY packages/core/ .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/core/dist ./dist
COPY --from=builder /app/packages/core/node_modules ./node_modules
COPY --from=builder /app/packages/core/package.json ./package.json
COPY --from=builder /app/packages/core/prompts ./prompts

# Copy data directories for templates
COPY data ./data

EXPOSE 3001

# Use tsx for running in production (simpler than building to JS)
CMD ["npx", "tsx", "src/server/index.ts"]
