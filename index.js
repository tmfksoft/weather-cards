// Weather Card API
// Created by Thomas Edwards (C) 2017

// API and Caching
const Hapi = require('hapi');
const Boom = require('boom');
const Joi = require('joi');
const Inert = require('inert');

const config = require('./config.js');
const redisClient = require('./lib/Redis.js');
const resourceManager = require('./lib/ResourceManager.js');
const Util = require('./lib/Util.js')(config.keys);

// NAtive
const fs = require('fs');

// = Add Fonts =
resourceManager.addFont("weather", "assets/fonts/weather_font.fnt");
resourceManager.addFont("weather_15", "assets/fonts/weather_font_15.fnt");
resourceManager.addFont("open_sans_regular_20", "assets/fonts/open_sans_regular_20.fnt");
resourceManager.addFont("open_sans_regular_15", "assets/fonts/open_sans_regular_15.fnt");
resourceManager.addFont("open_sans_light_23_temp", "assets/fonts/open_sans_light_23_temp.fnt");

// = Add Images =
// Fallbacks
resourceManager.addImage("na_day", "assets/backgrounds/na.png");
resourceManager.addImage("na_afternoon", "assets/backgrounds/na.png");
resourceManager.addImage("na_night", "assets/backgrounds/na.png");

// GUI Overlay
resourceManager.addImage("overlay_white", "assets/backgrounds/overlay_white.png");
resourceManager.addImage("overlay_black", "assets/backgrounds/overlay_black.png");
// Sun
resourceManager.addImage("sun_day", "assets/backgrounds/background_sun_day.png");
resourceManager.addImage("sun_afternoon", "assets/backgrounds/background_sun_afternoon.png");
resourceManager.addImage("sun_night", "assets/backgrounds/background_sun_night.png");
// Very Cloudy
resourceManager.addImage("cloudy_day", "assets/backgrounds/background_cloudy_day.png");
resourceManager.addImage("cloudy_afternoon", "assets/backgrounds/background_cloudy_afternoon.png");
resourceManager.addImage("cloudy_night", "assets/backgrounds/background_cloudy_night.png");
// Very Cloudy
resourceManager.addImage("light_cloud_day", "assets/backgrounds/background_light_cloud_day.png");
resourceManager.addImage("light_cloud_afternoon", "assets/backgrounds/background_light_cloud_afternoon.png");
resourceManager.addImage("light_cloud_night", "assets/backgrounds/background_light_cloud_night.png");
// Mist
resourceManager.addImage("mist_day", "assets/backgrounds/background_mist_day.png");
resourceManager.addImage("mist_afternoon", "assets/backgrounds/background_mist_afternoon.png");
resourceManager.addImage("mist_night", "assets/backgrounds/background_mist_night.png");
// Light Rain / Drizzle
resourceManager.addImage("light_rain_day", "assets/backgrounds/background_light_rain_day.png");
resourceManager.addImage("light_rain_afternoon", "assets/backgrounds/background_light_rain_afternoon.png");
resourceManager.addImage("light_rain_night", "assets/backgrounds/background_light_rain_night.png");

// Setup our HTTPD Stuffs
let httpd = new Hapi.Server();
httpd.connection(config.servers.hapi);

// Start the chain!
resourceManager.loadResources()
.then( () => {
    httpd.start( err => {
        if (err) throw err;
        console.log(`Started up HTTPD listening at ${httpd.info.uri}`);
    });
});

// Inert for static files
httpd.register(Inert);

// Register our routes.
httpd.route({
    method: 'GET',
    path: '/v1/card',
    config: {
        validate: {
            query: {
                location: Joi.string().required()
            }
        }
    },
    handler: (request, reply) => {
        Util.rateLimited(request.info.remoteAddress)
        .then( limited => {
            if (limited) return reply(Boom.tooManyRequests());

            let location = request.query.location;
            let cacheKey = `image:${Util.normalizeLocation(location)}`;
            
            // Check the cache
            redisClient.get(cacheKey, (err, val) => {
                if (err) throw err;
    
                // Is it there?
                if (val != null) {
                    // Return from cache
                    let img = Buffer.from(val, 'binary');
                    return reply(img).type("image/png");
                }
    
                // Generate and cache it
                Util.generateCard(location)
                .then( image => {
                    redisClient.set(cacheKey, image.toString('binary'), 'EX', 60);
                    reply(image).type('image/png');
                });
            });
        })
        .catch( err => {
            reply(err);
        });
    }
});

httpd.route({
    method: 'GET',
    path: '/v1/weather',
    config: {
        validate: {
            query: {
                location: Joi.string().required()
            }
        }
    },
    handler: (request, reply) => {
        Util.rateLimited(request.info.remoteAddress)
        .then( limited => {
            if (limited) return reply(Boom.tooManyRequests());

            let location = request.query.location;
            Util.getWeather(location)
            .then( weather => {
                return reply(weather);
            })
            .catch( err => {
                console.log("Whoops, error!", err.error);
                if (err.statusCode == 404) {
                    reply(Boom.notFound('Location not found.'));
                } else {
                    reply(Boom.internal(`API Threw an unknown error ${err.message}`));
                }
            } );
        })
        .catch( err => {
            throw err;
            return reply(err);
        });
    }
});