FROM oven/bun:1-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production --frozen-lockfile

COPY src ./src
COPY public ./public

USER bun
EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "src/server.js"]
