FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --prefer-offline

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev:renderer", "--", "--host", "0.0.0.0"]
