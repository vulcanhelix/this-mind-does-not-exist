# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY packages/core/package*.json ./
RUN npm ci
COPY packages/core/ .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY packages/core/prompts ./prompts
EXPOSE 3001
CMD ["npm", "start"]
