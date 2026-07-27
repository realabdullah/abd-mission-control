FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @abd-mission-control/web build
EXPOSE 3000
CMD ["node", "apps/web/.output/server/index.mjs"]
