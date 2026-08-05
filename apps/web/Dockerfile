# Built from the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, not
# read at runtime — so this has to be a build ARG, not just an env var on
# the running container. Render passes matching env vars as build args
# automatically for Dockerfile-based services.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @swms/web build

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
