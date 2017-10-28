// Card Generation
const request = require('request-promise'); // HTTP Request Library
const Jimp = require('jimp'); // Image processing library
const _ = require('lodash'); // Array handling and utility methods
const uuidV4 = require('uuid/v4'); // UUID Generator for temporary storage
const moment = require('moment'); // Date formatting and handling
require('moment-timezone'); // Timezone support for moment
const SunCalc = require('suncalc'); // Moon/Sun Position & Phases.

const redisClient = require('./Redis.js'); // Caching
const resourceManager = require('./ResourceManager.js'); // Our Resources

const config = require('../config.js');

class Util {

    constructor(keys) {
        this.keys = keys;
    }

    // Converts long and lat to x & y tile coords.
    // http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#ECMAScript_.28JavaScript.2FActionScript.2C_etc..29
    // Used for OpenStreetMap
    // Example https://b.tile.openstreetmap.org/18/130118/85430.png
    long2tile(lon,zoom) { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }
    lat2tile(lat,zoom)  { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }

    // Copied from Jimp Sauce
    // Measures the width of some text based on the font.
    measureText (font, text) {
        var x = 0;
        for (let i = 0; i < text.length; i++) {
            if (font.chars[text[i]]) {
                x += font.chars[text[i]].xoffset +
                (font.kernings[text[i]] && font.kernings[text[i]][text[i+1]]
                    ? font.kernings[text[i]][text[i+1]] : 0) +
                (font.chars[text[i]].xadvance || 0);
            }
        }
        return x;
    }

    // Gets the timezone information from cache is possible
    getTimezone(lon, lat) {
        // Caches the data for 1hr
        let timestamp = Math.floor(Date.now()/1000);
        let cacheKey = `googleapi:timezone:${lat},${lon}`;
        return new Promise( (resolve, reject) => {
            redisClient.get(cacheKey, (err, reply) => {
                if (err) return reject(err);
                if (reply) return resolve(JSON.parse(reply));
                return request(`https://maps.googleapis.com/maps/api/timezone/json?key=${this.keys.google_maps}&timestamp=${timestamp}&location=${lat},${lon}`, { json: true })
                .then( data => {
                    redisClient.set(cacheKey, JSON.stringify(data), 'EX', 3600);
                    resolve(data);
                })
                .catch(reject);
            });
        });
    }

    // Gets weather data for a location
    getWeather(location, skip /* Skip Cache? */) {
        let locationKey = `openweathermap:${this.normalizeLocation(location)}`;
        return new Promise( (resolve, reject) => {
            redisClient.get(locationKey, (err, reply) => {
                if (err) return reject(err);
                if (reply) return resolve(JSON.parse(reply));
                request(`http://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${this.keys.weather}`, { json: true })
                .then( data => {
                    console.log(data);
                    // Store in the redis cache for 5 minutes.
                    redisClient.set(locationKey, JSON.stringify(data), 'EX', 60*5);
                    resolve(data);
                })
                .catch(reject);
            });
        });
        request(`http://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${this.keys.weather}`, { json: true });
    }
    normalizeLocation(location) {
        // Attempts to make the location reasonably similar to other requests.
        // Though this is most useful against the same requests repeated within a short period of time.
        return location.toLowerCase().replace(/\s/g,"-").replace(",","");
    }

    generateCard(location) {
        return new Promise( (resolve, reject) => {

            this.getWeather(location)
            .then( weather => {
    
                var fahrenheit = 1.8 * (weather.main.temp - 273) + 32;
                var celcius = ((fahrenheit-32)*5)/9;
                // New
                new Jimp(450, 100, (err, image) => {
                    
                    // Time in that location
                    this.getTimezone(weather.coord.lon, weather.coord.lat)
                    .then( data => {
    
                        let imagePath = `temp/${uuidV4()}.png`;
                        
                        let weatherState = "na";
                        let bgs = {
                            "shower-rain": "light_rain", // wi-showers
                            "light-rain": "light_rain", // wi-sleet
                            "broken-clouds": "cloudy", // wi-cloud
                            "scattered-clouds": "cloudy", // wi-cloud
                            "overcast-clouds": "cloudy", // wi-cloud
                            "clear-sky": "sun", // wi-day-sunny
                            "haze": "mist", // wi-day-haze
                            "few-clouds": "light_cloud", // wi-day-cloudy
                            "mist": "mist", // wi-fog
                            "light-intensity-drizzle-rain": "light_rain",
                            "light-intensity-drizzle": "light_rain",
                            "na": "sun",
                        };
    
                        let weather_short = weather.weather[0].description.toLowerCase().replace(/\s/g,"-");
                        if (bgs[weather_short]) {
                            weatherState = bgs[weather_short];
                        }
    
                        let weatherAlert = false;
    
                        let timestamp = Math.floor(Date.now() / 1000);
                        console.log(data);
                        //let date = moment.utc().unix( (timestamp + data.rawOffset + data.dstOffset ) );
                        let date = moment().tz(data.timeZoneId);
                        let hour = date.format("H");
                        console.log(`Current time at that location is ${hour}`);
    
                        let timeOfDay = "none";
    
                        if (hour >= 0 && hour <= 6) timeOfDay = "night"; // 12:00am - 6:59am
                        if (hour >= 7 && hour < 9) timeOfDay = "afternoon"; // 7:00am - 8:59am
                        if (hour >= 9 && hour <= 18) timeOfDay = "day"; // 9:00am - 6:59pm
                        if (hour > 18 && hour < 21) timeOfDay = "afternoon"; // 7:00pm - 8:59pm
                        if (hour >= 21 && hour <= 23) timeOfDay = "night"; // 9:00pm - 11:59pm
    
                        let back = resourceManager.getImage(`${weatherState}_${timeOfDay}`);
                        if (back == null) throw new Error(`Failed to get background for weather card. Background '${weatherState}_${timeOfDay}' for weather ${weather_short}`);
                        image.composite(back.data, 0, 0);
                    
                        // Any extra elements
                        let moonPhases = SunCalc.getMoonIllumination(date.toDate());
                        console.log("Moon Phases", moonPhases);
    
                        let moonPhase = "New Moon";
                        if (moonPhases.phase == 0) moonPhase = "New Moon";
                        if (moonPhases.phase > 0 && moonPhases.phase < 0.25) moonPhase = "Waxing Crescent";
                        if (moonPhases.phase == 0.25) moonPhase = "First Quarter";
                        if (moonPhases.phase > 0.25 && moonPhases.phase < 0.5) moonPhase = "Waxing Gibbous";
                        if (moonPhases.phase == 0.5) moonPhase = "Full Moon";
                        if (moonPhases.phase > 0.5 && moonPhases.phase < 0.75) moonPhase = "Waning Gibbous";
                        if (moonPhases.phase == 0.75) moonPhase = "Last Quarter";
                        if (moonPhases.phase > 0.75) moonPhase = "Waning Crescent";
    
                        let overlay = resourceManager.getImage('overlay_black');
                        if (overlay != null) image.composite(overlay.data, 0, 0);
    
                        new Jimp(back.data.bitmap.width, back.data.bitmap.height, function(err, text){
    
                            let weatherFont = resourceManager.getFont("weather");
                            if (!weatherFont) return;
                            
                            let weatherFont15 = resourceManager.getFont("weather_15");
                            if (!weatherFont15) return;
                            
                            let OpenSans20 = resourceManager.getFont("open_sans_regular_20");
                            if (!OpenSans20) return;
                            
                            let OpenSans15 = resourceManager.getFont("open_sans_regular_15");
                            if (!OpenSans15) return;
                            
                            let OpenSans23 = resourceManager.getFont("open_sans_light_23_temp");
                            if (!OpenSans23) return;
    
                            // Location
                            text.print(OpenSans20.data,17,12,`${weather.name}, ${weather.sys.country}`);
    
                            // Weather Description
                            text.print(OpenSans15.data,17,38,`${weather.weather[0].main} (${weather.weather[0].description})`);
    
                            // Moon Phase
                            if (timeOfDay == "night") {
                                text.print(OpenSans15.data,17,58,`Moon: ${moonPhase}`);
                            }
                            
                            // Temperature
                            text.print(OpenSans23.data,270,16,`${Math.round(celcius)}°C`);
                            text.print(OpenSans23.data,270,48,`${Math.round(fahrenheit)}°F`);
    
                            // Info Bar
                            text.print(OpenSans15.data,12,78,date.format("dddd, h:mma"));
    
                            // Humidity
                            text.print(weatherFont15.data,287,76,``); // wi-humidity
                            text.print(OpenSans15.data,305,78,`${weather.main.humidity}%`);
    
                            // Wind Speed
                            text.print(weatherFont15.data,359,78,String.fromCharCode(0xf050)); // wi-strong-wind
                            text.print(OpenSans15.data,380,79,`${weather.wind.speed}mph`);
                            
                            if (weatherAlert) {
                                text.print(OpenSans15.font,(430/2) - measureText(OpenSans15.font, weatherAlert)/2,65,weatherAlert);
                            }
                            
                            let shadow = text.clone();
                            shadow.gaussian(2);
    
                            image.composite(shadow, 0, 0);
                            image.composite(text, 0, 0);
                            
                            image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
								if (err) return reject(err);
								resolve(buffer);
                            });
                            
                        });
                    }).catch(reject);
                });
            }).catch(reject);

        });
    }

    // Is this user rate limited?
    rateLimited(ip) {
        return new Promise( (resolve, reject) => {
            // Boom.tooManyRequests([message], [data])
            redisClient.get(`ratelimit:${ip}`, (err, reply) => {
                if (err) return reject(err);

                if (reply == null) {
                    // They're not stored. Allow them.

                    // Store their IP and max requests for the next minute.
                    redisClient.set(`ratelimit:${ip}`, config.general.ratelimit, 'EX', 60);
                    return resolve(false);
                }

                // Are they out of requests?
                if (reply <= 0) return resolve(true);

                // Not out of requests, tick down one
                redisClient.set(`ratelimit:${ip}`, reply-1, 'EX', 60);

                resolve(false);

            });
        });
    }

    // Attempts to get the moons phase based on a location at the current time.
    getMoonPhase(lon, lat) {
        return new Promise( (resolve, reject) => {
            this.getTimezone(lon,lat)
            .then( timezone => {
                if (timezone.status != "OK") return reject(timezone);

                let date = moment().tz(timezone.timeZoneId);

                // Any extra elements
                let moonPhases = SunCalc.getMoonIllumination(date.toDate());

                let moonPhase = "New Moon";
                if (moonPhases.phase == 0) moonPhase = "New Moon";
                if (moonPhases.phase > 0 && moonPhases.phase < 0.25) moonPhase = "Waxing Crescent";
                if (moonPhases.phase == 0.25) moonPhase = "First Quarter";
                if (moonPhases.phase > 0.25 && moonPhases.phase < 0.5) moonPhase = "Waxing Gibbous";
                if (moonPhases.phase == 0.5) moonPhase = "Full Moon";
                if (moonPhases.phase > 0.5 && moonPhases.phase < 0.75) moonPhase = "Waning Gibbous";
                if (moonPhases.phase == 0.75) moonPhase = "Last Quarter";
                if (moonPhases.phase > 0.75) moonPhase = "Waning Crescent";

                moonPhases.phaseName = moonPhase;
                resolve(moonPhases);
            });
        });
    }
}
module.exports = (keys)=>{ return new Util(keys); }