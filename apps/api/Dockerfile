FROM oven/bun:1.2-alpine AS base

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml bun.lock* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install

COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

WORKDIR /workspace/apps/api

EXPOSE 8787

CMD ["bun", "run", "src/index.ts"]
