FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install
COPY . .

# Generar el cliente de Prisma para auth-service
RUN npx prisma generate --schema apps/auth-service/prisma/schema.prisma

# Compilar
RUN npm run build auth-service

EXPOSE 8001
CMD ["node", "dist/apps/auth-service/auth-service/src/main.js"]
