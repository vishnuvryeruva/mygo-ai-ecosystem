#!/bin/bash
set -e

# ─── Config ───────────────────────────────────────────────────────────────────
DOCKER_USER="vishnuvryeruva98"
NEXT_PUBLIC_BACKEND_URL="https://mygo-backend-vd2026.cfapps.us10-001.hana.ondemand.com"
CF_API="https://api.cf.us10-001.hana.ondemand.com"
MANIFEST_FILE="manifest.yml"   # change to manifest.yaml if that's your actual filename

TAG="v$(date +%Y%m%d%H%M)"
FRONTEND_IMAGE="$DOCKER_USER/mygo-frontend:$TAG"
BACKEND_IMAGE="$DOCKER_USER/mygo-backend:$TAG"

# ╔═════════════════════════════════════════════════════════════════════════════╗
# ║                        ⚠️  ENV VARS REMINDER  ⚠️                           ║
# ╠═════════════════════════════════════════════════════════════════════════════╣
# ║                                                                             ║
# ║  Env vars are NOT version-controlled (manifest.yml is on GitHub).           ║
# ║  If you add a new env var to your code, you MUST also run cf set-env        ║
# ║  manually — this script does NOT set env vars.                              ║
# ║                                                                             ║
# ║  ─── BACKEND env vars (mygo-backend) ───────────────────────────────────    ║
# ║                                                                             ║
# ║    cf set-env mygo-backend OPENAI_API_KEY "sk-..."                          ║
# ║    cf set-env mygo-backend CLAUDE_API_KEY "sk-ant-..."                      ║
# ║    cf set-env mygo-backend GEMINI_API_KEY "..."                             ║
# ║    cf set-env mygo-backend JWT_SECRET "..."                                 ║
# ║    cf set-env mygo-backend SECURE_API_KEY "..."                             ║
# ║    cf set-env mygo-backend CALM_API_ENDPOINT "..."                          ║
# ║    cf set-env mygo-backend CALM_TOKEN_URL "..."                             ║
# ║    cf set-env mygo-backend CALM_CLIENT_ID "..."                             ║
# ║    cf set-env mygo-backend CALM_CLIENT_SECRET "..."                         ║
# ║    cf set-env mygo-backend AI_CORE_DEPLOYMENT_ID "d5d6c3c8c49ab116"         ║
# ║    cf set-env mygo-backend AI_CORE_RESOURCE_GROUP "default"                 ║
# ║    cf set-env mygo-backend AI_CORE_MODEL "anthropic--claude-4.5-haiku"      ║
# ║                                                                             ║
# ║    After setting backend env vars:                                          ║
# ║      cf restage mygo-backend                                                ║
# ║                                                                             ║
# ║  ─── FRONTEND env vars (mygo-frontend) ─────────────────────────────────    ║
# ║                                                                             ║
# ║    cf set-env mygo-frontend NEXT_PUBLIC_BACKEND_URL "https://..."           ║
# ║                                                                             ║
# ║    NOTE: NEXT_PUBLIC_* vars are baked at BUILD time. cf set-env only        ║
# ║    affects server-side code (like next.config.js rewrites). For client-     ║
# ║    side code, the value is baked from the --build-arg passed to docker.     ║
# ║                                                                             ║
# ║    After setting frontend env vars:                                         ║
# ║      cf restage mygo-frontend                                               ║
# ║                                                                             ║
# ║  ─── To see currently set env vars ─────────────────────────────────────    ║
# ║                                                                             ║
# ║      cf env mygo-backend                                                    ║
# ║      cf env mygo-frontend                                                   ║
# ║                                                                             ║
# ╚═════════════════════════════════════════════════════════════════════════════╝

# ─── Sanity check ─────────────────────────────────────────────────────────────
if [ ! -f "$MANIFEST_FILE" ]; then
  echo "❌ $MANIFEST_FILE not found in $(pwd)"
  exit 1
fi

# ─── Auth ─────────────────────────────────────────────────────────────────────
echo "🔐 Logging into Docker Hub..."
docker login

echo "🔐 Logging into Cloud Foundry..."
cf login -a $CF_API

# ─── Build (linux/amd64 for BTP) ──────────────────────────────────────────────
echo "📦 Building frontend image ($FRONTEND_IMAGE) for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
  -t $FRONTEND_IMAGE \
  --push \
  .

echo "📦 Building backend image ($BACKEND_IMAGE) for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  -t $BACKEND_IMAGE \
  --push \
  ./backend

# ─── Update manifest ──────────────────────────────────────────────────────────
echo "📝 Updating $MANIFEST_FILE..."
cp $MANIFEST_FILE ${MANIFEST_FILE}.bak
sed -i '' \
  -e "s|$DOCKER_USER/mygo-frontend:.*|$DOCKER_USER/mygo-frontend:$TAG|" \
  -e "s|$DOCKER_USER/mygo-backend:.*|$DOCKER_USER/mygo-backend:$TAG|" \
  $MANIFEST_FILE

# ─── Deploy ───────────────────────────────────────────────────────────────────
echo "☁️  Deploying to Cloud Foundry..."
cf push

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Deployment complete!"
echo "   Tag     : $TAG"
echo "   Frontend: https://mygo-frontend-vd2026.cfapps.us10-001.hana.ondemand.com"
echo "   Backend : https://mygo-backend-vd2026.cfapps.us10-001.hana.ondemand.com"
echo ""
echo "⚠️  REMINDER: If you added new env vars to your code, set them via 'cf set-env'"
echo "   (see the env vars section at the top of this script)"
echo "   Then run: cf restage mygo-backend  (or mygo-frontend)"