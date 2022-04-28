FROM node:16.14.0

RUN apt-get updated
RUN apt-get install redis -y

WORKDIR /app
COPY . /app/

RUN yarn install
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]