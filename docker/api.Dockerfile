# API (Fastify + core) with Chromium for PDF rendering (Playwright image matches playwright-core 1.55).
FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @sauna/api... --ignore-scripts
COPY packages/core packages/core
COPY apps/api apps/api
ENV NODE_ENV=production CHROMIUM_PATH="" PORT=3000
EXPOSE 3000
USER pwuser
WORKDIR /app/apps/api
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "--import", "tsx", "src/main.ts"]
