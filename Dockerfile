# -------------------------------------------------------------
# Stage 1: Build (TypeScript & Vite)
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# کپی وابستگی‌ها برای استفاده از لایه‌های کَش داکر
COPY package*.json ./
RUN npm ci

# کپی سورس‌کد
COPY . .

# تزریق آدرس بک‌اند پروداکشن در زمان بیلد
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# اجرای بیلد نهایی
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Runtime (Nginx Alpine ~25MB)
# -------------------------------------------------------------
FROM nginx:alpine

# جایگزینی کانفیگ Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# انتقال آرتیفکت‌های بیلد شده از استیج اول
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]