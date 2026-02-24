FROM node:20-slim

# Install CA certs (needed for Litestream HTTPS to GCS) and Litestream
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz /tmp/litestream.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz && rm /tmp/litestream.tar.gz

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data && chmod +x /app/start.sh && sed -i 's/\r$//' /app/start.sh

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["/app/start.sh"]
