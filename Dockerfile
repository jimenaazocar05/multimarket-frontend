FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Horneado en build: TanStack Start/Vite inlinea las VITE_* en el bundle
# (cliente y SSR), no hay forma de setearlo solo en runtime.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
CMD ["node", ".output/server/index.mjs"]
