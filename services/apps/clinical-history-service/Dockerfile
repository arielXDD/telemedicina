FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Generar el cliente de Prisma para clinical-history-service
RUN npx prisma generate --schema apps/clinical-history-service/prisma/schema.prisma

# Compilar
RUN npm run build clinical-history-service

EXPOSE 8003
# Asegurarse de sincronizar la base de datos local SQLite antes de iniciar
CMD ["sh", "-c", "npx prisma db push --schema apps/clinical-history-service/prisma/schema.prisma && npm run start:prod clinical-history-service"]
