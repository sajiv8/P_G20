# ╔══════════════════════════════════════════════════════════════╗
# ║  Stage 1: BUILD                                             ║
# ║  React app එක build කරමු (static HTML/CSS/JS output)       ║
# ╚══════════════════════════════════════════════════════════════╝
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Vite build → /app/dist folder එකට static files output වෙනවා
RUN npm run build


# ╔══════════════════════════════════════════════════════════════╗
# ║  Stage 2: SERVE                                              ║
# ║  Nginx server එකෙන් static files serve කරමු               ║
# ╚══════════════════════════════════════════════════════════════╝
FROM nginx:1.27-alpine AS production

# Custom nginx config copy කරමු
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build stage එකෙන් static files copy කරමු nginx serve directory එකට
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx foreground එකේ run කරමු (container එක live තියාගන්න)
CMD ["nginx", "-g", "daemon off;"]