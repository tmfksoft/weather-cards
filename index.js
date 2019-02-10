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

// Native
const fs = require('fs');

// = Add Fonts =
//resourceManager.addFont("weather", "assets/fonts/weather_font.fnt");
//resourceManager.addFont("weather_15", "assets/fonts/weather_font_15.fnt");
//resourceManager.addFont("open_sans_regular_20", "assets/fonts/open_sans_regular_20.fnt");
//resourceManager.addFont("open_sans_regular_15", "assets/fonts/open_sans_regular_15.fnt");
//resourceManager.addFont("open_sans_light_23_temp", "assets/fonts/open_sans_light_23_temp.fnt");

resourceManager.addFont("open_sans_regular", "assets/fonts/OpenSans-Regular.ttf", { family: 'Open Sans', weight: 400, style: 'normal' });
resourceManager.addFont("open_sans_light", "assets/fonts/OpenSans-Light.ttf", { family: 'Open Sans Light', weight: 300 });
resourceManager.addFont("weather_icons", "assets/fonts/weathericons-regular-webfont.ttf", { family: 'Weather Icons' });

// = Add Images =

// GUI Overlay
resourceManager.addImage("overlay", "assets/elements/overlay.png");

// Night Assets
resourceManager.addImage("element_night", "assets/elements/night.png");
resourceManager.addImage("element_moon", "assets/elements/moon.png");
resourceManager.addImage("element_moon_halloween", "assets/elements/moon_halloween.png");
resourceManager.addImage("element_moon_mask", "assets/elements/moon_mask.png");

// Day Assets
resourceManager.addImage("element_day", "assets/elements/day.png");
resourceManager.addImage("element_afternoon", "assets/elements/afternoon.png");
resourceManager.addImage("element_sun_bright", "assets/elements/sun_bright.png");
resourceManager.addImage("element_sun_sunset", "assets/elements/sun_sunset.png");

// General Assets
resourceManager.addImage("element_clouds", "assets/elements/clouds.png");
resourceManager.addImage("element_rain", "assets/elements/rain.png");
resourceManager.addImage("element_bats", "assets/elements/halloween_bats.png");
resourceManager.addImage("element_light_snow", "assets/elements/light_snow.png");
resourceManager.addImage("element_heavy_snow", "assets/elements/heavy_snow.png");
resourceManager.addImage("element_mist", "assets/elements/mist.png");
resourceManager.addImage("element_dust", "assets/elements/dust.png");

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

// Support for being behind a reverse proxy.
httpd.ext({
    type: 'onRequest',
    method: function (request, reply) {
        // Is the forwarded header set?
        if (typeof request.headers['x-forwarded-for'] != "undefined") {
            let proxyIP = request.info.remoteAddress;
            let ips = request.headers['x-forwarded-for'].split(',');
            if (config.general.trustedProxies.indexOf(proxyIP) >= 0) {
                request.info.proxyAddress = proxyIP;
                request.info.remoteAddress = ips[0];
            }
        }
        return reply.continue();
    }
});

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
                if (val != null && !config.dev) {
                    // Return from cache
                    let img = Buffer.from(val, 'binary');
                    return reply(img).type("image/png");
                }
    
                // Generate and cache it
                Util.generateCard(location)
                .then( image => {
                    redisClient.set(cacheKey, image.toString('binary'), 'EX', 60);
                    reply(image).type('image/png');
                })
                .catch( err => {
                    console.log("ERROR", err);
                    reply(Boom.create(err.code, err.message));
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

httpd.route({
    method: 'GET',
    path: '/v1/timezone',
    config: {
        validate: {
            query: {
                lat: Joi.number().min(0).max(90).required(),
                lon: Joi.number().min(-180).max(180).required(),
            }
        }
    },
    handler: (request, reply) => {
        Util.rateLimited(request.info.remoteAddress)
        .then( limited => {
            if (limited) return reply(Boom.tooManyRequests());

            Util.getTimezone(request.query.lon, request.query.lat)
            .then( timezone => {
                if (timezone.status != "OK") {
                    if (timezone.status == "ZERO_RESULTS") return reply(Boom.badData("Invalid Location"));
                }
                return reply(timezone);
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

httpd.route({
    method: 'GET',
    path: '/v1/moon',
    config: {
        validate: {
            query: {
                lat: Joi.number().min(0).max(90).required(),
                lon: Joi.number().min(-180).max(180).required(),
            }
        }
    },
    handler: (request, reply) => {
        Util.rateLimited(request.info.remoteAddress)
        .then( limited => {
            if (limited) return reply(Boom.tooManyRequests());

            Util.getMoonPhase(request.query.lon, request.query.lat)
            .then( moon => {
                return reply(moon);
            })
            .catch( err => {
                console.log("Whoops, error!", err.error);
                if (err.status == "ZERO_RESULTS") {
                    reply(Boom.badData('Invalid Location'));
                } else {
                    reply(Boom.internal(`API Threw an unknown error ${err.status}`));
                }
            } );
        })
        .catch( err => {
            throw err;
            return reply(err);
        });
    }
});