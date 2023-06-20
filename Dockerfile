# syntax=docker/dockerfile:1

FROM node:16.20.0
ENV NODE_ENV=production

WORKDIR /dockerApp

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

COPY . .
CMD ["node", "main.js"]