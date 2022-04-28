Weather Card
=====
Weather Card is a fully NodeJS API that provides rendered PNG weather cards for use in IM programs.
This takes the load off the scripts serving the IM program and doesn't require the client script to have
image processing capability.

Redis Caching
=====
Redis is used extensively to cache data within the application to avoid rate limits and generally respect APIs it uses.

Open Weather Map API
---
This is used to fetch the weather data in the first place, data from this API is cached for 5 minutes.

Google Maps Timezone API
---
This is used to get the timezone for the lat/long supplied by the weather API in order to correctly display the users time.
Data from this API is cached for an hour. This may result in weather cards being out by an hour when daylight savings starts or ends.

Next Steps
=====

Rate Limiting
---
Basic rate limiting is implemented using Redis. A key is set and counts down from the max requests in a minute since the first request.
When the key hits zero the user is denied access until the key expires.

Installation
=====
Getting the API up and running is pretty simple.

Clone this repository into a directory and run `npm install` followed by `npm build`

Afterwards make a copy of config/default.js and name it config/production.js or config/development.js depending on your NODE_ENV
Alter the server setup as you wish, the `hapi` section sets the port and host the api runs on.
The `redis` section sets the port and host the api connects to redis on.

Obtain API keys from OpenWeatherMap and Google Maps Timezone API and put them in the corresponding part of the configuration.

Run like any other node script with `node .` or `npm start`

Heroku / Dokku
=====
Heroku and Dokku support is coming shortly so I can host this project myself in the cloud.

For now, an untested patch has been applied adding the following changes:

config.js has been added as a default config, this is used by Heroku or Dokku.
PORT, GMAPS_KEY and OWP_KEY have been added.

PORT = Set be Heroku and Dokku to be the default HTTP Port to listen on.
OWP_KEY = The Open Weather Maps API Key - Set this yourself.
GMAP_KEY = The Google Maps API Key - Set this yourself.
