FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install
COPY . .

# Generar el cliente de Prisma para clinical-history-service
RUN npx prisma generate --schema apps/clinical-history-service/prisma/schema.prisma

# Compilar
RUN npm run build clinical-history-service

EXPOSE 8003
CMD ["node", "dist/apps/clinical-history-service/clinical-history-service/src/main.js"]
