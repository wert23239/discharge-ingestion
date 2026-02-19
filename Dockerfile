FROM node:20-alpine

WORKDIR /app

# Client build
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build

# Server build
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server ./server
RUN cd server && npx prisma generate

# Copy sample data + client dist for serving
COPY sample-data ./sample-data

EXPOSE 10000
ENV PORT=10000 NODE_ENV=production

CMD cd server && npx prisma db push && npx tsx src/index.ts
