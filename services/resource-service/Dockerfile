# ╔══════════════════════════════════════════════════════════════╗
# ║  Stage 1: BUILD                                             ║
# ║  මෙතැනින් TypeScript compile කරනවා JavaScript වලට          ║
# ╚══════════════════════════════════════════════════════════════╝
FROM node:22-alpine AS builder

# Alpine image එක භාවිතා කරන්නේ size අඩු නිසා (~50MB vs ~350MB)
# Full node:22 image එක MB 350ක් - alpine version එක MB 50ක්

WORKDIR /app

# package.json පමණක් පළමුව copy කරන්නේ Docker layer caching 
# advantage එක ගන්න. Dependencies වෙනස් නොවේ නම් cache 
# hit වෙනවා — build time ගොඩක් අඩු වෙනවා
COPY package.json package-lock.json* ./

# Dependencies install කරමු (ci = clean install, lockfile exact match)
RUN npm ci

# ඉතිරි source code copy කරමු
COPY tsconfig.json ./
COPY src ./src

# TypeScript → JavaScript compile කරමු
RUN npm run build


# ╔══════════════════════════════════════════════════════════════╗
# ║  Stage 2: PRODUCTION                                        ║
# ║  Compiled JS code එක පමණක් lightweight image එකට copy      ║
# ╚══════════════════════════════════════════════════════════════╝
FROM node:22-alpine AS production

# Security: root user ලෙස run කරන්නේ නෑ
# "appuser" කියලා non-root user එකක් create කරනවා
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Production dependencies පමණක් install කරමු (devDependencies නෑ)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Build stage එකෙන් compiled code එක copy කරමු
COPY --from=builder /app/dist ./dist

# Non-root user ලෙස switch කරමු
USER appuser

# Container එක expose කරන port එක
EXPOSE 3003

# Health check - K8s probes වලට අමතරව Docker level health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Application start කරමු
CMD ["node", "dist/index.js"]
