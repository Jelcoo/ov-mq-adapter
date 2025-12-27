FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./

FROM base AS build

RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-alpine AS runtime

WORKDIR /app
RUN corepack enable pnpm

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
