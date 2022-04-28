// Weather Card API
// Created by Thomas Edwards (C) 2017

// API and Caching
import Hapi from '@hapi/hapi';
import Boom from '@hapi/boom';
import Inert from '@hapi/inert';
import Joi from 'joi';

import ResourceManager from './lib/ResourceManager';
import RedisClient from './lib/Redis';
import Util from './lib/Util';

import config from 'vault-config';
import path from 'path';

class WeatherCards {

	public util = new Util(this);
	public HTTPD: Hapi.Server;
	public resourceManager = new ResourceManager();

	constructor() {
		this.HTTPD = new Hapi.Server({
			...config.get('servers.hapi'),
			debug: {
				log: ['*'],
				request: ['*']
			}
		});
	}

	loadResources() {

		// = Add Fonts =
		//resourceManager.addFont("weather", "assets/fonts/weather_font.fnt");
		//resourceManager.addFont("weather_15", "assets/fonts/weather_font_15.fnt");
		//resourceManager.addFont("open_sans_regular_20", "assets/fonts/open_sans_regular_20.fnt");
		//resourceManager.addFont("open_sans_regular_15", "assets/fonts/open_sans_regular_15.fnt");
		//resourceManager.addFont("open_sans_light_23_temp", "assets/fonts/open_sans_light_23_temp.fnt");

		this.resourceManager.addFont("open_sans_regular", path.join(__dirname, "../assets/fonts/OpenSans-Regular.ttf"), { family: 'Open Sans', weight: 400, style: 'normal' });
		this.resourceManager.addFont("open_sans_light", path.join(__dirname, "../assets/fonts/OpenSans-Light.ttf"), { family: 'Open Sans Light', weight: 300 });
		this.resourceManager.addFont("weather_icons", path.join(__dirname, "../assets/fonts/weathericons-regular-webfont.ttf"), { family: 'Weather Icons' });

		// = Add Images =

		// GUI Overlay
		this.resourceManager.addImage("overlay", path.join(__dirname, "..", "assets/elements/overlay.png"));

		// Night Assets
		this.resourceManager.addImage("element_night", path.join(__dirname, "../assets/elements/night.png"));
		this.resourceManager.addImage("element_moon", path.join(__dirname, "../assets/elements/moon.png"));
		this.resourceManager.addImage("element_moon_halloween", path.join(__dirname, "../assets/elements/moon_halloween.png"));
		this.resourceManager.addImage("element_moon_mask", path.join(__dirname, "../assets/elements/moon_mask.png"));

		// Day Assets
		this.resourceManager.addImage("element_day", path.join(__dirname, "../assets/elements/day.png"));
		this.resourceManager.addImage("element_afternoon", path.join(__dirname, "../assets/elements/afternoon.png"));
		this.resourceManager.addImage("element_sun_bright", path.join(__dirname, "../assets/elements/sun_bright.png"));
		this.resourceManager.addImage("element_sun_sunset", path.join(__dirname, "../assets/elements/sun_sunset.png"));

		// General Assets
		this.resourceManager.addImage("element_clouds", path.join(__dirname, "../assets/elements/clouds.png"));
		this.resourceManager.addImage("element_rain", path.join(__dirname, "../assets/elements/rain.png"));
		this.resourceManager.addImage("element_bats", path.join(__dirname, "../assets/elements/halloween_bats.png"));
		this.resourceManager.addImage("element_light_snow", path.join(__dirname, "../assets/elements/light_snow.png"));
		this.resourceManager.addImage("element_heavy_snow", path.join(__dirname, "../assets/elements/heavy_snow.png"));
		this.resourceManager.addImage("element_mist", path.join(__dirname, "../assets/elements/mist.png"));
		this.resourceManager.addImage("element_dust", path.join(__dirname, "../assets/elements/dust.png"));
	}

	async start() {

		// Add the resources.
		this.loadResources();

		// Start the chain!
		await this.resourceManager.loadResources();

		// Inert for static files
		await this.HTTPD.register(Inert);

		// Support for being behind a reverse proxy.
		this.HTTPD.ext({
			type: 'onRequest',
			method: function (request, reply) {
				// Is the forwarded header set?
				if (typeof request.headers['x-forwarded-for'] != "undefined") {
					let proxyIP = request.info.remoteAddress;
					let ips = request.headers['x-forwarded-for'].split(',');
					if (config.get('general.trustedProxies').indexOf(proxyIP) >= 0) {
						(request.info as any).proxyAddress = proxyIP;
						request.info.remoteAddress = ips[0];
					}
				}
				return reply.continue;
			}
		});

		// Register our routes.
		this.HTTPD.route({
			method: 'GET',
			path: '/v1/card',
			options: {
				validate: {
					query: Joi.object({
						location: Joi.string().required()
					})
				}
			},
			handler: async (req, h) => {

				const limited = await this.util.rateLimited(req.info.remoteAddress);
				if (limited) {
					return Boom.tooManyRequests();
				}

				let location = req.query.location;
				let cacheKey = `image:${this.util.normalizeLocation(location)}`;
				
				// Check the cache
				const cacheVal = await RedisClient.get('cacheKey');
				
				// Is it there?
				// Dev should be a CLI flag.
				if (cacheVal != null && !config.get('dev')) {
					// Return from cache
					let img = Buffer.from(cacheVal, 'binary');
					return h.response(img).type("image/png");
				}
		
				// Generate and cache it
				const image = await this.util.generateCard(location);
				await RedisClient.set(cacheKey, image.toString('binary'), {
					EX: 60
				});
				return h.response(image).type('image/png');
			}
		});

		this.HTTPD.route({
			method: 'GET',
			path: '/v1/weather',
			options: {
				validate: {
					query: Joi.object({
						location: Joi.string().required()
					}),
				},
			},
			handler: async (req, h) => {

				const limited = await this.util.rateLimited(req.info.remoteAddress);

				if (limited) {
					return Boom.tooManyRequests();
				}

				let location = req.query.location;
				return this.util.getWeather(location)
				.then( weather => {
					return weather;
				})
				.catch( err => {
					console.log("Whoops, error!", err.error);
					if (err.statusCode == 404) {
						return Boom.notFound('Location not found.');
					} else {
						return Boom.internal(`API Threw an unknown error ${err.message}`);
					}
				} );
			}
		});

		this.HTTPD.route({
			method: 'GET',
			path: '/v1/timezone',
			options: {
				validate: {
					query: Joi.object({
						lat: Joi.number().min(0).max(90).required(),
						lon: Joi.number().min(-180).max(180).required(),
					}),
				},
			},
			handler: async (req, h) => {
				return this.util.rateLimited(req.info.remoteAddress)
				.then( limited => {
					if (limited) {
						return Boom.tooManyRequests();
					}

					return this.util.getTimezone(req.query.lon, req.query.lat)
					.then( timezone => {
						if (timezone.status != "OK") {
							if (timezone.status == "ZERO_RESULTS") {
								return Boom.badData("Invalid Location");
							}
						}
						return timezone;
					})
					.catch( err => {
						console.log("Whoops, error!", err.error);
						if (err.statusCode == 404) {
							return Boom.notFound('Location not found.');
						} else {
							return Boom.internal(`API Threw an unknown error ${err.message}`);
						}
					} );
				})
				.catch( err => {
					throw err;
					return err;
				});
			}
		});

		this.HTTPD.route({
			method: 'GET',
			path: '/v1/moon',
			options: {
				validate: {
					query: Joi.object({
						lat: Joi.number().min(0).max(90).required(),
						lon: Joi.number().min(-180).max(180).required(),
					})
				}
			},
			handler: async (req, h) => {
				return this.util.rateLimited(req.info.remoteAddress)
				.then( limited => {
					if (limited) {
						return Boom.tooManyRequests();
					}

					return this.util.getMoonPhase(req.query.lon, req.query.lat)
					.catch( err => {
						console.log("Whoops, error!", err.error);
						if (err.status == "ZERO_RESULTS") {
							return Boom.badData('Invalid Location');
						} else {
							return Boom.internal(`API Threw an unknown error ${err.status}`);
						}
					} );
				})
				.catch( err => {
					throw err;
					return err;
				});
			}
		});
		await this.HTTPD.start();
	}
}
const api = new WeatherCards();
api.start();

export default api;
export { api, WeatherCards };