FROM node:16.14.0

RUN apt-get update
RUN apt-get install redis-server supervisor -y

USER node

WORKDIR /home/node/app
COPY --chown=node:node . /home/node/app/

RUN npm install
RUN npm run build

USER root
ENV NODE_EV production

ENTRYPOINT [ "supervisord", "-n" ]