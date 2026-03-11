FROM node:22-slim AS base
RUN npm install -g pnpm@10
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy server source (needed by web for shared types import)
COPY server/ server/

# Build web
COPY web/ web/
RUN pnpm --filter web build
RUN pnpm --filter server build

# Production stage
FROM node:22-slim AS production
RUN npm install -g pnpm@10
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=base /app/server/package.json server/
COPY --from=base /app/web/package.json web/
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY --from=base /app/server/dist server/dist/
COPY --from=base /app/server/drizzle server/drizzle/
COPY --from=base /app/web/dist web/dist/

ENV NODE_ENV=production
ENV DATABASE_URL=/data/bramble.db
ENV PORT=3000
EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "server/dist/index.js"]
