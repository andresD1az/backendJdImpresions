# Frontend Dockerfile (Vite build + Nginx serve)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build with API base proxied through /api from Nginx
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build

FROM nginx:1.27-alpine AS serve
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist ./
# Replace default server config with our SPA + /api proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
