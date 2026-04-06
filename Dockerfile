FROM node:22-slim AS base
RUN npm install -g pnpm@10
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY server/package.json server/
COPY web/package.json web/
COPY mcp/package.json mcp/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy server source (needed by web for shared types import)
COPY server/ server/

# Build web
COPY web/ web/
RUN pnpm --filter web build
RUN pnpm --filter server build

# Build MCP server
COPY mcp/ mcp/
RUN pnpm --filter bramble-mcp build

# Production stage
FROM node:22-slim AS production
RUN npm install -g pnpm@10
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=base /app/server/package.json server/
COPY --from=base /app/web/package.json web/
COPY --from=base /app/mcp/package.json mcp/
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY --from=base /app/server/dist server/dist/
COPY --from=base /app/server/drizzle server/drizzle/
COPY --from=base /app/web/dist web/dist/
COPY --from=base /app/mcp/dist mcp/dist/
COPY docker-entrypoint.sh .

ENV NODE_ENV=production
ENV DATABASE_URL=/data/bramble.db
ENV PHOTOS_DIR=/data/photos
ENV PORT=3000
EXPOSE 3000

VOLUME ["/data"]

CMD ["./docker-entrypoint.sh"]
