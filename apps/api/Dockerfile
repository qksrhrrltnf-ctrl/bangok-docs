# Cloud Run 용 이미지. 저장소 루트에서 빌드한다:
#   docker build -f apps/api/Dockerfile -t school-hwp-api .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root=false --ignore-scripts
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --include-workspace-root=false --omit=dev --ignore-scripts
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
