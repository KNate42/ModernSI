# Production image of the ModernSI site: the Next.js standalone server, run as the non-root "node" user.
# This work made by Anfinogentov Nikita
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# the npm cache survives a package-lock change, so only new packages are downloaded
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# rewrites are fixed at build time; inside compose the API is the "api" service
ARG API_URL=http://api:8040
ENV API_URL=$API_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ARG API_URL=http://api:8040
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 API_URL=$API_URL
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
