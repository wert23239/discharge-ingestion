FROM node:22-alpine

WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm ci --production=false

# Build client
COPY client ./client
RUN cd client && npm ci && npm run build

# Build server
COPY server ./server
COPY sample-data ./sample-data
RUN cd server && npm ci && npx prisma generate && npx prisma db push

# Server serves client/dist as static files
EXPOSE 3001
ENV PORT=3001 NODE_ENV=production

CMD ["npx", "--prefix", "server", "tsx", "src/index.ts"]
