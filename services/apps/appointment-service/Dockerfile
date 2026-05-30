FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install
COPY . .

# Generar el cliente de Prisma para appointment-service
RUN npx prisma generate --schema apps/appointment-service/prisma/schema.prisma

# Compilar
RUN npm run build appointment-service

EXPOSE 8002
CMD ["node", "dist/apps/appointment-service/appointment-service/src/main.js"]
