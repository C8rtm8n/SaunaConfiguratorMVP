# Static front ends: embed.js, configurator, admin and a demo manufacturer page, served by nginx.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/viewer/package.json packages/viewer/
COPY apps/embed/package.json apps/embed/
COPY apps/configurator/package.json apps/configurator/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @sauna/embed... --filter @sauna/configurator... --filter @sauna/admin... --ignore-scripts
COPY packages packages
COPY apps/embed apps/embed
COPY apps/configurator apps/configurator
COPY apps/admin apps/admin
ARG API_URL=http://localhost:3000
ARG PUBLIC_URL=http://localhost:8080
RUN cd apps/embed && npx vite build \
 && cd ../configurator && VITE_API_BASE=$API_URL npx vite build \
 && cd ../admin && VITE_API_BASE=$API_URL npx vite build \
 && mkdir -p /site && cp ../embed/dist/embed.js /site/ \
 && cp -r ../configurator/dist /site/configurator && cp -r ../admin/dist /site/admin \
 && sed "s#__CDN__#$PUBLIC_URL#" ../embed/demo/host.html > /site/index.html

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
EXPOSE 80
