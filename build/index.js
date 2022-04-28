"use strict";
// Weather Card API
// Created by Thomas Edwards (C) 2017
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherCards = exports.api = void 0;
// API and Caching
const hapi_1 = __importDefault(require("@hapi/hapi"));
const boom_1 = __importDefault(require("@hapi/boom"));
const inert_1 = __importDefault(require("@hapi/inert"));
const joi_1 = __importDefault(require("joi"));
const ResourceManager_1 = __importDefault(require("./lib/ResourceManager"));
const Redis_1 = __importDefault(require("./lib/Redis"));
const Util_1 = __importDefault(require("./lib/Util"));
const vault_config_1 = __importDefault(require("vault-config"));
const path_1 = __importDefault(require("path"));
class WeatherCards {
    constructor() {
        this.util = new Util_1.default(this);
        this.resourceManager = new ResourceManager_1.default();
        this.HTTPD = new hapi_1.default.Server(Object.assign(Object.assign({}, vault_config_1.default.get('servers.hapi')), { debug: {
                log: ['*'],
                request: ['*']
            } }));
    }
    loadResources() {
        // = Add Fonts =
        //resourceManager.addFont("weather", "assets/fonts/weather_font.fnt");
        //resourceManager.addFont("weather_15", "assets/fonts/weather_font_15.fnt");
        //resourceManager.addFont("open_sans_regular_20", "assets/fonts/open_sans_regular_20.fnt");
        //resourceManager.addFont("open_sans_regular_15", "assets/fonts/open_sans_regular_15.fnt");
        //resourceManager.addFont("open_sans_light_23_temp", "assets/fonts/open_sans_light_23_temp.fnt");
        this.resourceManager.addFont("open_sans_regular", path_1.default.join(__dirname, "../assets/fonts/OpenSans-Regular.ttf"), { family: 'Open Sans', weight: 400, style: 'normal' });
        this.resourceManager.addFont("open_sans_light", path_1.default.join(__dirname, "../assets/fonts/OpenSans-Light.ttf"), { family: 'Open Sans Light', weight: 300 });
        this.resourceManager.addFont("weather_icons", path_1.default.join(__dirname, "../assets/fonts/weathericons-regular-webfont.ttf"), { family: 'Weather Icons' });
        // = Add Images =
        // GUI Overlay
        this.resourceManager.addImage("overlay", path_1.default.join(__dirname, "..", "assets/elements/overlay.png"));
        // Night Assets
        this.resourceManager.addImage("element_night", path_1.default.join(__dirname, "../assets/elements/night.png"));
        this.resourceManager.addImage("element_moon", path_1.default.join(__dirname, "../assets/elements/moon.png"));
        this.resourceManager.addImage("element_moon_halloween", path_1.default.join(__dirname, "../assets/elements/moon_halloween.png"));
        this.resourceManager.addImage("element_moon_mask", path_1.default.join(__dirname, "../assets/elements/moon_mask.png"));
        // Day Assets
        this.resourceManager.addImage("element_day", path_1.default.join(__dirname, "../assets/elements/day.png"));
        this.resourceManager.addImage("element_afternoon", path_1.default.join(__dirname, "../assets/elements/afternoon.png"));
        this.resourceManager.addImage("element_sun_bright", path_1.default.join(__dirname, "../assets/elements/sun_bright.png"));
        this.resourceManager.addImage("element_sun_sunset", path_1.default.join(__dirname, "../assets/elements/sun_sunset.png"));
        // General Assets
        this.resourceManager.addImage("element_clouds", path_1.default.join(__dirname, "../assets/elements/clouds.png"));
        this.resourceManager.addImage("element_rain", path_1.default.join(__dirname, "../assets/elements/rain.png"));
        this.resourceManager.addImage("element_bats", path_1.default.join(__dirname, "../assets/elements/halloween_bats.png"));
        this.resourceManager.addImage("element_light_snow", path_1.default.join(__dirname, "../assets/elements/light_snow.png"));
        this.resourceManager.addImage("element_heavy_snow", path_1.default.join(__dirname, "../assets/elements/heavy_snow.png"));
        this.resourceManager.addImage("element_mist", path_1.default.join(__dirname, "../assets/elements/mist.png"));
        this.resourceManager.addImage("element_dust", path_1.default.join(__dirname, "../assets/elements/dust.png"));
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Add the resources.
            this.loadResources();
            // Start the chain!
            yield this.resourceManager.loadResources();
            // Inert for static files
            yield this.HTTPD.register(inert_1.default);
            // Support for being behind a reverse proxy.
            this.HTTPD.ext({
                type: 'onRequest',
                method: function (request, reply) {
                    // Is the forwarded header set?
                    if (typeof request.headers['x-forwarded-for'] != "undefined") {
                        let proxyIP = request.info.remoteAddress;
                        let ips = request.headers['x-forwarded-for'].split(',');
                        if (vault_config_1.default.get('general.trustedProxies').indexOf(proxyIP) >= 0) {
                            request.info.proxyAddress = proxyIP;
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
                        query: joi_1.default.object({
                            location: joi_1.default.string().required()
                        })
                    }
                },
                handler: (req, h) => __awaiter(this, void 0, void 0, function* () {
                    const limited = yield this.util.rateLimited(req.info.remoteAddress);
                    if (limited) {
                        return boom_1.default.tooManyRequests();
                    }
                    let location = req.query.location;
                    let cacheKey = `image:${this.util.normalizeLocation(location)}`;
                    // Check the cache
                    const cacheVal = yield Redis_1.default.get('cacheKey');
                    // Is it there?
                    // Dev should be a CLI flag.
                    if (cacheVal != null && !vault_config_1.default.get('dev')) {
                        // Return from cache
                        let img = Buffer.from(cacheVal, 'binary');
                        return h.response(img).type("image/png");
                    }
                    // Generate and cache it
                    const image = yield this.util.generateCard(location);
                    yield Redis_1.default.set(cacheKey, image.toString('binary'), {
                        EX: 60
                    });
                    return h.response(image).type('image/png');
                })
            });
            this.HTTPD.route({
                method: 'GET',
                path: '/v1/weather',
                options: {
                    validate: {
                        query: joi_1.default.object({
                            location: joi_1.default.string().required()
                        }),
                    },
                },
                handler: (req, h) => __awaiter(this, void 0, void 0, function* () {
                    const limited = yield this.util.rateLimited(req.info.remoteAddress);
                    if (limited) {
                        return boom_1.default.tooManyRequests();
                    }
                    let location = req.query.location;
                    return this.util.getWeather(location)
                        .then(weather => {
                        return weather;
                    })
                        .catch(err => {
                        console.log("Whoops, error!", err.error);
                        if (err.statusCode == 404) {
                            return boom_1.default.notFound('Location not found.');
                        }
                        else {
                            return boom_1.default.internal(`API Threw an unknown error ${err.message}`);
                        }
                    });
                })
            });
            this.HTTPD.route({
                method: 'GET',
                path: '/v1/timezone',
                options: {
                    validate: {
                        query: joi_1.default.object({
                            lat: joi_1.default.number().min(0).max(90).required(),
                            lon: joi_1.default.number().min(-180).max(180).required(),
                        }),
                    },
                },
                handler: (req, h) => __awaiter(this, void 0, void 0, function* () {
                    return this.util.rateLimited(req.info.remoteAddress)
                        .then(limited => {
                        if (limited) {
                            return boom_1.default.tooManyRequests();
                        }
                        return this.util.getTimezone(req.query.lon, req.query.lat)
                            .then(timezone => {
                            if (timezone.status != "OK") {
                                if (timezone.status == "ZERO_RESULTS") {
                                    return boom_1.default.badData("Invalid Location");
                                }
                            }
                            return timezone;
                        })
                            .catch(err => {
                            console.log("Whoops, error!", err.error);
                            if (err.statusCode == 404) {
                                return boom_1.default.notFound('Location not found.');
                            }
                            else {
                                return boom_1.default.internal(`API Threw an unknown error ${err.message}`);
                            }
                        });
                    })
                        .catch(err => {
                        throw err;
                        return err;
                    });
                })
            });
            this.HTTPD.route({
                method: 'GET',
                path: '/v1/moon',
                options: {
                    validate: {
                        query: joi_1.default.object({
                            lat: joi_1.default.number().min(0).max(90).required(),
                            lon: joi_1.default.number().min(-180).max(180).required(),
                        })
                    }
                },
                handler: (req, h) => __awaiter(this, void 0, void 0, function* () {
                    return this.util.rateLimited(req.info.remoteAddress)
                        .then(limited => {
                        if (limited) {
                            return boom_1.default.tooManyRequests();
                        }
                        return this.util.getMoonPhase(req.query.lon, req.query.lat)
                            .catch(err => {
                            console.log("Whoops, error!", err.error);
                            if (err.status == "ZERO_RESULTS") {
                                return boom_1.default.badData('Invalid Location');
                            }
                            else {
                                return boom_1.default.internal(`API Threw an unknown error ${err.status}`);
                            }
                        });
                    })
                        .catch(err => {
                        throw err;
                        return err;
                    });
                })
            });
            yield this.HTTPD.start();
        });
    }
}
exports.WeatherCards = WeatherCards;
const api = new WeatherCards();
exports.api = api;
api.start();
exports.default = api;
