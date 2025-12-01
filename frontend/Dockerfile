# Estágio de Build (Node)
FROM node:20-alpine AS build
WORKDIR /app
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