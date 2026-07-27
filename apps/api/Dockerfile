FROM node:22-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @abd-mission-control/api build
EXPOSE 3001
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
