FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS tools
COPY supabase ./supabase
COPY scripts/bootstrap-server.mjs ./scripts/bootstrap-server.mjs
CMD ["sh"]

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG APP_URL
ENV ERP_RUNTIME=ubuntu NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY APP_URL=$APP_URL
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim AS scheduler
WORKDIR /app
COPY scripts/ubuntu-scheduler.mjs ./scheduler.mjs
USER node
CMD ["node", "scheduler.mjs"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 ERP_RUNTIME=ubuntu HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
