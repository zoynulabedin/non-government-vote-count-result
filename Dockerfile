# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
# This requires the schema.prisma file to be present (copied in previous step)
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install openssl for Prisma
RUN apk add --no-cache openssl

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install production dependencies
RUN npm ci --omit=dev && npm install prisma dotenv

# Copy the generated Prisma Client from the builder stage
# This is crucial because 'npm ci --omit=dev' won't run the generation script effectively without the CLI
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy the build output
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
# Copy prisma schema in case it's needed at runtime (e.g. for migrations, though usually not recommended in the app container)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
