"use strict";
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
// Card Generation
const request = require('request-promise'); // HTTP Request Library
const canvas_1 = __importDefault(require("canvas")); // Image Renderer
const moment_1 = __importDefault(require("moment")); // Date formatting and handling
require("moment-timezone"); // Timezone support for moment
const suncalc_1 = __importDefault(require("suncalc")); // Moon/Sun Position & Phases.
const Redis_1 = __importDefault(require("./Redis"));
const vault_config_1 = __importDefault(require("vault-config"));
class Util {
    constructor(api) {
        this.api = api;
    }
    // Converts long and lat to x & y tile coords.
    // http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#ECMAScript_.28JavaScript.2FActionScript.2C_etc..29
    // Used for OpenStreetMap
    // Example https://b.tile.openstreetmap.org/18/130118/85430.png
    long2tile(lon, zoom) { return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom))); }
    lat2tile(lat, zoom) { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); }
    // Copied from Jimp Sauce
    // Measures the width of some text based on the font.
    measureText(font, text) {
        var x = 0;
        for (let i = 0; i < text.length; i++) {
            if (font.chars[text[i]]) {
                x += font.chars[text[i]].xoffset +
                    (font.kernings[text[i]] && font.kernings[text[i]][text[i + 1]]
                        ? font.kernings[text[i]][text[i + 1]] : 0) +
                    (font.chars[text[i]].xadvance || 0);
            }
        }
        return x;
    }
    // Gets the timezone information from cache is possible
    getTimezone(lon, lat) {
        return __awaiter(this, void 0, void 0, function* () {
            // Caches the data for 1hr
            let timestamp = Math.floor(Date.now() / 1000);
            let cacheKey = `googleapi:timezone:${lat},${lon}`;
            const cachedResponse = yield Redis_1.default.get(cacheKey);
            if (cachedResponse) {
                return JSON.parse(cachedResponse);
            }
            const apiResponse = yield request(`https://maps.googleapis.com/maps/api/timezone/json?key=${vault_config_1.default.get('keys.google_maps')}&timestamp=${timestamp}&location=${lat},${lon}`, { json: true });
            Redis_1.default.set(cacheKey, JSON.stringify(apiResponse), {
                EX: 3600
            });
            return apiResponse;
        });
    }
    // Gets weather data for a location
    getWeather(location, skip /* Skip Cache? */) {
        return __awaiter(this, void 0, void 0, function* () {
            let locationKey = `openweathermap:${this.normalizeLocation(location)}`;
            const cachedResponse = yield Redis_1.default.get(locationKey);
            if (cachedResponse) {
                return JSON.parse(cachedResponse);
            }
            const apiResponse = yield request(`http://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${vault_config_1.default.get('keys.weather')}`, { json: true });
            yield Redis_1.default.set(locationKey, JSON.stringify(apiResponse), {
                EX: 60 * 5
            });
            return apiResponse;
        });
    }
    normalizeLocation(location) {
        // Attempts to make the location reasonably similar to other requests.
        // Though this is most useful against the same requests repeated within a short period of time.
        return location.toLowerCase().replace(/\s/g, "-").replace(",", "");
    }
    generateCard(location) {
        return __awaiter(this, void 0, void 0, function* () {
            const weather = yield this.getWeather(location);
            const mainCanvas = canvas_1.default.createCanvas(450, 100);
            const mainContext = mainCanvas.getContext("2d");
            const fahrenheit = 1.8 * (weather.main.temp - 273) + 32;
            const celcius = ((fahrenheit - 32) * 5) / 9;
            const timezone = yield this.getTimezone(weather.coord.lon, weather.coord.lat);
            if (timezone.status !== "OK")
                return Promise.reject(timezone);
            // Get the weather and find different properties.
            let weatherDesc = weather.weather[0].description.toLowerCase().split(" ");
            let weatherProperties = [];
            // Different forms of light weather effects.
            if (weatherDesc.includes("light") || weatherDesc.includes("few") || weatherDesc.includes("broken") || weatherDesc.includes("scattered")) {
                weatherProperties.push("light");
            }
            // Different specifics.
            // https://openweathermap.org/weather-conditions more stuff can be found here.
            if (weatherDesc.includes("clouds"))
                weatherProperties.push("cloud");
            if (weatherDesc.includes("mist"))
                weatherProperties.push("mist");
            if (weatherDesc.includes("clear"))
                weatherProperties.push("clear");
            if (weatherDesc.includes("dust"))
                weatherProperties.push("dust");
            if (weatherDesc.includes("rain"))
                weatherProperties.push("rain");
            if (weatherDesc.includes("snow"))
                weatherProperties.push("snow");
            console.log(`Current Weather is ${weatherProperties.toString()}`);
            let weatherAlert = false;
            // Get the current time and current period of the day.
            let timestamp = Math.floor(Date.now() / 1000);
            let date = (0, moment_1.default)().tz(timezone.timeZoneId);
            let hour = parseInt(date.format("H"));
            console.log(`Current time at that location is ${hour}`);
            let timeOfDay = "none";
            if (hour >= 0 && hour <= 6)
                timeOfDay = "night"; // 12:00am - 6:59am
            if (hour >= 7 && hour < 9)
                timeOfDay = "afternoon"; // 7:00am - 8:59am
            if (hour >= 9 && hour <= 18)
                timeOfDay = "day"; // 9:00am - 6:59pm
            if (hour > 18 && hour < 21)
                timeOfDay = "afternoon"; // 7:00pm - 8:59pm
            if (hour >= 21 && hour <= 23)
                timeOfDay = "night"; // 9:00pm - 11:59pm
            // Time of Day - Based on the sunset and sunrise given by the weather API
            if (date.format("X") >= weather.sys.sunrise && date.format("X") <= weather.sys.sunset) {
                timeOfDay = "day";
            }
            else {
                timeOfDay = "night";
            }
            // Is the sun setting right now? (15min period so it looks nice)
            if (date.format("X") >= weather.sys.sunrise && parseInt(date.format("X")) <= (weather.sys.sunrise - 900)) {
                timeOfDay = "afternoon";
            }
            else if (date.format("X") <= weather.sys.sunset && parseInt(date.format("X")) >= (weather.sys.sunset - 900)) {
                timeOfDay = "afternoon";
            }
            // Get the backdrop
            let back = this.api.resourceManager.getImage(`element_${timeOfDay}`);
            if (back == null)
                throw new Error(`Failed to get background for weather card. Background '${timeOfDay}'`);
            mainContext.drawImage(back.data, 0, 0);
            // Get the moons phase
            let moonPhases = suncalc_1.default.getMoonIllumination(date.toDate());
            let moonStage = 0;
            if (moonPhases.phase > 0 && moonPhases.phase < 0.25) {
                moonStage = 1;
            }
            if (moonPhases.phase == 0.25) {
                moonStage = 2;
            }
            if (moonPhases.phase > 0.25 && moonPhases.phase < 0.5) {
                moonStage = 3;
            }
            if (moonPhases.phase == 0.5) {
                moonStage = 4;
            }
            if (moonPhases.phase > 0.5 && moonPhases.phase < 0.75) {
                moonStage = 5;
            }
            if (moonPhases.phase == 0.75) {
                moonStage = 6;
            }
            if (moonPhases.phase > 0.75) {
                moonStage = 7;
            }
            // Position of the sun and the moon in the sky.
            let sunPos = suncalc_1.default.getPosition(date.toDate(), weather.coord.lat, weather.coord.lat);
            let sunPercent = sunPos.altitude / (Math.PI / 2);
            let moonPos = suncalc_1.default.getMoonPosition(date.toDate(), weather.coord.lat, weather.coord.lat);
            let moonPercent = -(moonPos.altitude / (Math.PI / 2));
            sunPercent = 100;
            moonPercent = 100;
            console.log(`Sun position (${sunPercent}) ${Math.round(sunPercent * 100)}%`, sunPos);
            console.log(`Moon position (${moonPercent}) ${Math.round(moonPercent * 100)}%`, moonPos);
            if (timeOfDay == "night") {
                let moon;
                if (parseInt(date.format("MM")) == 10) {
                    const halloweenMoon = this.api.resourceManager.getImage("element_moon_halloween");
                    if (halloweenMoon) {
                        moon = halloweenMoon.data;
                    }
                }
                else {
                    const normalMoon = this.api.resourceManager.getImage("element_moon");
                    if (normalMoon) {
                        moon = normalMoon.data;
                    }
                }
                if (!moon) {
                    throw new Error("Error loading moon texture!");
                }
                let mask = this.api.resourceManager.getImage("element_moon_mask");
                moonStage = 2;
                let northenHemisphere = true;
                if (weather.coord.lat <= -0)
                    northenHemisphere = false;
                console.log(`Is ${location} ${weather.coord.lat} in the northen hemisphere? ${northenHemisphere}`);
                // Add in the moon
                const moonCanvas = canvas_1.default.createCanvas(moon.width, moon.height);
                const moonContext = moonCanvas.getContext("2d");
                moonContext.drawImage(moon, 0, 0);
                if (mask) {
                    moonContext.globalCompositeOperation = "source-in";
                    moonContext.drawImage(mask.data, -(110 * moonStage), 0);
                }
                if (northenHemisphere == false)
                    mainContext.scale(-1, 1);
                let current = (102 / 100) * Math.round(moonPercent * 100);
                current = 0;
                mainContext.drawImage(moonCanvas, 340, -15 + current);
                mainContext.scale(1, 1);
            }
            else if (timeOfDay == "afternoon") {
                // Add the afternoon sun
                const sunTexture = this.api.resourceManager.getImage("element_sun_sunset");
                if (!sunTexture) {
                    throw new Error("Unable to load sun texture!");
                }
                let sun = sunTexture.data;
                if (weatherProperties.includes("rain") || weatherProperties.includes("mist") || weatherProperties.includes("cloud")) {
                    mainContext.globalAlpha = .5;
                }
                // Current sun position (102 Pixels for full sunset)
                let current = (102 / 100) * Math.round(sunPercent * 100);
                mainContext.drawImage(sun, 243, -112 + current);
                mainContext.globalAlpha = 1;
            }
            else if (timeOfDay == "day") {
                // Add the daytime sun
                let sun;
                if (weatherProperties.includes("mist")) {
                    // Misty? Sun won't be too bright.
                    // Or even here..?
                }
                else {
                    const sunTexture = this.api.resourceManager.getImage("element_sun_bright");
                    sun = sunTexture;
                }
                if (sun) {
                    // -42 = Fully risen ;)
                    let current = (102 / 100) * Math.round(sunPercent * 100);
                    current = 0;
                    mainContext.drawImage(sun.data, 313, -42 + current);
                }
            }
            // Add in mist
            let mist = this.api.resourceManager.getImage("element_mist");
            if (weatherProperties.includes("mist") && mist) {
                mainContext.globalAlpha = .5;
                mainContext.drawImage(mist.data, 0, 0);
                mainContext.globalAlpha = 1;
            }
            // Add in dust
            let dust = this.api.resourceManager.getImage("element_dust");
            if (weatherProperties.includes("mist") && dust) {
                mainContext.globalAlpha = .5;
                mainContext.drawImage(dust.data, 0, 0);
                mainContext.globalAlpha = 1;
            }
            // Add in the clouds.
            let cloud = this.api.resourceManager.getImage("element_clouds");
            if (cloud) {
                if (weatherProperties.includes("cloud") || weatherProperties.includes("rain")) {
                    if (weatherProperties.includes("rain") || weatherProperties.includes("light")) {
                        mainContext.globalAlpha = 0.25;
                    }
                    else {
                        mainContext.globalAlpha = 0.75;
                    }
                    mainContext.drawImage(cloud.data, 0, 0);
                    mainContext.globalAlpha = 1;
                }
            }
            // Add in rain.
            let rain = this.api.resourceManager.getImage("element_rain");
            if (weatherProperties.includes("rain") && rain) {
                mainContext.drawImage(rain.data, 0, 0);
            }
            if (weatherProperties.includes("snow")) {
                let snow = this.api.resourceManager.getImage("element_light_snow");
                if (snow)
                    mainContext.drawImage(snow.data, 0, 0);
            }
            if (timeOfDay == "night") {
                // If the month is October add bats.
                if (parseInt(date.format("MM")) == 10) {
                    let bats = this.api.resourceManager.getImage("element_bats");
                    if (bats) {
                        mainContext.drawImage(bats.data, 0, 0);
                    }
                }
            }
            // Gets the overlay
            let overlay = this.api.resourceManager.getImage('overlay');
            if (overlay)
                mainContext.drawImage(overlay.data, 0, 0);
            // Set the font style
            mainContext.fillStyle = "white";
            mainContext.textBaseline = "top";
            // Location
            mainContext.font = '20px "Open Sans"';
            mainContext.fillText(`${weather.name}, ${weather.sys.country}`, 17, 12);
            // Weather Description
            mainContext.font = '15px "Open Sans"';
            mainContext.fillText(`${weather.weather[0].main} (${weather.weather[0].description})`, 17, 38);
            // Info Bar
            mainContext.fillText(date.format("dddd, h:mma"), 12, 76);
            // Temperature
            mainContext.font = '23px "Open Sans Light"';
            mainContext.fillText(`${Math.round(celcius)}°C`, 270, 5);
            mainContext.fillText(`${Math.round(fahrenheit)}°F`, 270, 35);
            // Humidity
            mainContext.font = '15px "Weather Icons"';
            mainContext.fillText(``, 287, 78); // wi-humidity
            mainContext.font = '15px "Open Sans"';
            mainContext.fillText(`${weather.main.humidity}%`, 305, 78);
            // Wind Speed
            mainContext.font = '15px "Weather Icons"';
            mainContext.fillText(String.fromCharCode(0xf050), 359, 78); // wi-strong-wind
            mainContext.font = '15px "Open Sans"';
            mainContext.fillText(`${weather.wind.speed}mph`, 380, 78);
            /*
            if (weatherAlert) {
                text.print(OpenSans15.font,(430/2) - measureText(OpenSans15.font, weatherAlert)/2,65,weatherAlert);
            }
            
            let shadow = text.clone();
            shadow.gaussian(1);
    
            image.composite(shadow, 0, 0);
            image.composite(text, 0, 0);
            */
            return yield mainCanvas.toBuffer();
        });
    }
    // Is this user rate limited?
    rateLimited(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            const limitVal = yield Redis_1.default.get(`ratelimit:${ip}`);
            if (limitVal == null) {
                // They're not stored. Allow them.
                // Store their IP and max requests for the next minute.
                Redis_1.default.set(`ratelimit:${ip}`, vault_config_1.default.get('general.ratelimit'), {
                    EX: 60
                });
                return false;
            }
            // Are they out of requests?
            if (parseInt(limitVal) <= 0) {
                return true;
            }
            // Not out of requests, tick down one
            Redis_1.default.set(`ratelimit:${ip}`, parseInt(limitVal) - 1, {
                EX: 60
            });
            return false;
        });
    }
    // Attempts to get the moons phase based on a location at the current time.
    getMoonPhase(lon, lat) {
        return new Promise((resolve, reject) => {
            this.getTimezone(lon, lat)
                .then(timezone => {
                if (timezone.status != "OK")
                    return reject(timezone);
                let date = (0, moment_1.default)().tz(timezone.timeZoneId);
                // Any extra elements
                let moonPhases = suncalc_1.default.getMoonIllumination(date.toDate());
                let moonPhase = "New Moon";
                if (moonPhases.phase == 0)
                    moonPhase = "New Moon";
                if (moonPhases.phase > 0 && moonPhases.phase < 0.25)
                    moonPhase = "Waxing Crescent";
                if (moonPhases.phase == 0.25)
                    moonPhase = "First Quarter";
                if (moonPhases.phase > 0.25 && moonPhases.phase < 0.5)
                    moonPhase = "Waxing Gibbous";
                if (moonPhases.phase == 0.5)
                    moonPhase = "Full Moon";
                if (moonPhases.phase > 0.5 && moonPhases.phase < 0.75)
                    moonPhase = "Waning Gibbous";
                if (moonPhases.phase == 0.75)
                    moonPhase = "Last Quarter";
                if (moonPhases.phase > 0.75)
                    moonPhase = "Waning Crescent";
                moonPhases.phaseName = moonPhase;
                resolve(moonPhases);
            });
        });
    }
}
exports.default = Util;
