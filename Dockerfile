FROM node:22-alpine
WORKDIR /app
COPY index.html server.mjs package.json ./
COPY src ./src
COPY icons ./icons
COPY fonts ./fonts
COPY vendor ./vendor
ENV PORT=8080 DATA_DIR=/app/data
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8080
VOLUME /app/data
CMD ["node", "server.mjs"]
