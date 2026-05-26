FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Generar el cliente de Prisma para appointment-service
RUN npx prisma generate --schema apps/appointment-service/prisma/schema.prisma

# Compilar
RUN npm run build appointment-service

EXPOSE 8002
# Asegurarse de sincronizar la base de datos local SQLite antes de iniciar
CMD ["sh", "-c", "npx prisma db push --schema apps/appointment-service/prisma/schema.prisma && npm run start:prod appointment-service"]
