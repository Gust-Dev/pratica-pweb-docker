# Estágio de Build (Node)
FROM node:20-alpine AS build
WORKDIR /app

# Build-time variables injected via docker-compose.yml
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Expose the variables to Vite during the build step
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY . .
RUN npm run build

# Estágio de Produção (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Remove a config padrão para usarmos a nossa
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80