# Node 24: node:sqlite is stable there, so the telemetry store needs no native
# module and this image needs no build toolchain.
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Only needed so the build can import modules that read it; the real secret is
# injected at runtime from .env.
ENV TELEMETRY_SECRET=buildtime
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# Run unprivileged; /data is the only writable path the app needs.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs raymail \
 && mkdir -p /data && chown raymail:nodejs /data

COPY --from=builder --chown=raymail:nodejs /app/.next/standalone ./
COPY --from=builder --chown=raymail:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=raymail:nodejs /app/public ./public

USER raymail
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
