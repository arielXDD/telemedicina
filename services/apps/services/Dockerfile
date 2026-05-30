FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install
COPY . .

# Generar todos los clientes Prisma necesarios para compilar y ejecutar
RUN npx prisma generate --schema apps/auth-service/prisma/schema.prisma
RUN npx prisma generate --schema apps/appointment-service/prisma/schema.prisma
RUN npx prisma generate --schema apps/clinical-history-service/prisma/schema.prisma

# Compilar
RUN npm run build services

EXPOSE 8000
CMD ["npm", "run", "start:prod", "services"]
