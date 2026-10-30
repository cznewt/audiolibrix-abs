FROM node:24-alpine AS build
WORKDIR /app
COPY package.json server.js ./
RUN npm install && npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist/server.js ./
EXPOSE 3002
CMD ["node", "server.js"]
