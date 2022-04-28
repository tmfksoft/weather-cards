FROM node:16.14.0

RUN apt-get update
RUN apt-get install redis-server -y

WORKDIR /app
COPY . /app/

RUN yarn install
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]