FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @abd-mission-control/collector build
EXPOSE 3003
CMD ["node", "apps/collector/dist/main.js"]
