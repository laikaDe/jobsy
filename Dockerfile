# Local, single-container Jobsy with SQLite persisted in a volume at /data.
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# lib/db.ts requires DATABASE_URL at import time; nothing connects during the build.
ENV DATABASE_URL="file:/data/jobsy.db"
RUN npm run build

FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL="file:/data/jobsy.db"
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
# Create/upgrade the schema in the volume, then serve. The Prisma client was generated at build time.
CMD ["sh", "-c", "npx prisma db push && npm start"]
