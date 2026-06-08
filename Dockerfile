# Yatzi v2 server — production Dockerfile
# Build context is the repo root. The server uses paths relative to v2/server/ to reach
# engine/ and shared/ at the project root, so we preserve that layout in the image.

FROM node:20-alpine AS base
ENV NODE_ENV=production

WORKDIR /app

# Install only production deps with ignored install scripts (defense in depth).
COPY v2/package.json v2/package-lock.json ./v2/
RUN cd v2 && npm ci --omit=dev --ignore-scripts

# Copy application code preserving relative layout
COPY engine ./engine
COPY shared ./shared
COPY v1 ./v1
COPY v2/server ./v2/server
COPY v2/client ./v2/client

# Drop privileges
USER node

EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
ENV TRUST_PROXY=1

WORKDIR /app/v2
CMD ["node", "server/index.js"]
