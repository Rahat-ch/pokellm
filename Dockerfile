# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built backend
COPY --from=backend-build /app/dist ./dist

# Copy built frontend to public directory
COPY --from=frontend-build /app/frontend/dist ./public

# Copy database schema for migrations
COPY src/db/schema.sql ./dist/db/schema.sql

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check - uses wget with 127.0.0.1 to force IPv4
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
