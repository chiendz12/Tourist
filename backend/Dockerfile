FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
 COPY package*.json ./
# Full install (devDeps included): @nestjs/cli is required to compile.
 RUN npm install
 COPY . .
 RUN npx prisma generate --schema=./prisma/schema.prisma
 RUN npm run build
# Slim down before shipping to the runner stage.
 RUN npm prune --omit=dev

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
