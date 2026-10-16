FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SHOW_PAYMENT_SIMULATOR=true
ENV NEXT_PUBLIC_SHOW_PAYMENT_SIMULATOR=$NEXT_PUBLIC_SHOW_PAYMENT_SIMULATOR
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3000
# BACKEND_URL is read at runtime by the /api proxy route.
CMD ["node", "server.js"]
