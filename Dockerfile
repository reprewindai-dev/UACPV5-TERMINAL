FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build frontend and server
RUN npm run build

EXPOSE 80

ENV PORT=80

CMD ["npm", "run", "start"]
