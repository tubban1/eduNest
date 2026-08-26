# Multi-stage build for eduNest Backend Service
FROM node:20-alpine AS base

# Install dependencies needed for sharp and native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy dependency definition
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose backend port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Run backend service
CMD ["node", "src/server.js"]
