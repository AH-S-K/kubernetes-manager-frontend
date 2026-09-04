# -------------------------------------------------------------
# Stage 1: Build (TypeScript & Vite)
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Inject the production backend URL at build time
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Run the final build
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Runtime (Nginx Alpine ~25MB)
# -------------------------------------------------------------
FROM nginx:stable-alpine3.24

# Replace the default Nginx configuration
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built artifacts from the first stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]