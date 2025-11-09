# Backend Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY .env.example ./

ENV NODE_ENV=production
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
EXPOSE 5000

CMD ["node", "src/index.js"]
