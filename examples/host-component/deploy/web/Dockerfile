# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.
# Build from the project root after keel build: docker build -f deploy/web/Dockerfile .
FROM node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
WORKDIR /app
COPY dist/web/ ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "--experimental-webstorage", "--localstorage-file=/data/storage", "--disable-warning=ExperimentalWarning", "server.mjs"]
