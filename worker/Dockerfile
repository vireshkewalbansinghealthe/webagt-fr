FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 8787
CMD ["npx", "wrangler", "dev", "--local", "--port", "8787", "--ip", "0.0.0.0"]
