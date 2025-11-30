# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Allow overriding API endpoint at build time
ARG VITE_API_BASE_URL=http://backend:3001
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Stage 2: serve static
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist ./

# Simple SPA fallback
RUN printf 'server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
