# Railway: connect a persistent volume at /data and set SETUP_KEY as a secret.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY soop.mjs ./
COPY public ./public
ENV NODE_ENV=production
ENV DB_FILE=/data/db.json
EXPOSE 3000
CMD ["node", "server.mjs"]
