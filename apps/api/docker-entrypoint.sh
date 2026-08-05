#!/bin/sh
set -e

echo "Running database migrations..."
(cd /app/packages/db && npx prisma migrate deploy)

# LOCAL_STORAGE_DIR is where LocalDiskStorage reads/writes. Seed data
# references the default template by a fixed storage key — make sure the
# actual file is there on first boot (idempotent: only copies if missing,
# so it never clobbers a template an admin has since replaced).
TEMPLATE_DEST="${LOCAL_STORAGE_DIR:-/app/apps/api/storage}/templates/general-construction-swms.docx"
if [ ! -f "$TEMPLATE_DEST" ]; then
  echo "Placing default SWMS template into storage..."
  mkdir -p "$(dirname "$TEMPLATE_DEST")"
  cp /app/packages/document-gen/templates/general-construction-swms.docx "$TEMPLATE_DEST"
fi

cd /app/apps/api
exec npx tsx src/server.ts
