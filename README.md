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