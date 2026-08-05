# Built from the monorepo root: docker build -f apps/api/Dockerfile .
# (needs the whole workspace, since apps/api depends on sibling
# packages/* via pnpm's "workspace:*" protocol)
FROM node:20-bookworm-slim

# libreoffice-writer (not the full suite) is enough for DOCX -> PDF
# conversion and keeps the image significantly smaller.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice-writer ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @swms/db generate

ENV NODE_ENV=production
ENV SOFFICE_PATH=soffice
ENV PORT=4000
EXPOSE 4000

RUN chmod +x apps/api/docker-entrypoint.sh
ENTRYPOINT ["apps/api/docker-entrypoint.sh"]
