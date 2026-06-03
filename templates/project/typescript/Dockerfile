# Stage 1: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock .
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 2: Run
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
ENTRYPOINT ["bun", "run", "./dist/index.js"]
