# ============================================================================
# Frontend Service — Multi-stage Docker Build
# Context: project root
# ============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root and frontend package manifests
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/

# Install all dependencies (workspaces support)
RUN npm install --ignore-scripts

# Copy the rest of the frontend source
COPY frontend/ ./frontend/

# Build the frontend workspace
RUN npm run build -w frontend

# ============================================================================
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# SPA fallback configuration for React Router
RUN echo 'server { \
    listen       80; \
    server_name  localhost; \
    location / { \
        root   /usr/share/nginx/html; \
        index  index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page   500 502 503 504  /50x.html; \
    location = /50x.html { \
        root   /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
