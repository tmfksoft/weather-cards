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
                        if (data.status != "OK") return reject(data);
                        
                        // Get the weather and find different properties.
                        let weatherDesc = weather.weather[0].description.toLowerCase().split(" ");
                        let weatherProperties = [];

                        // Different forms of light weather effects.
                        if ( weatherDesc.includes("light") || weatherDesc.includes("few") || weatherDesc.includes("broken") || weatherDesc.includes("scattered")) {
                            weatherProperties.push("light");
                        }
                        
                        // Different specifics.
                        // https://openweathermap.org/weather-conditions more stuff can be found here.
                        if ( weatherDesc.includes("clouds") ) weatherProperties.push("cloud");
                        if ( weatherDesc.includes("mist") ) weatherProperties.push("mist");
                        if ( weatherDesc.includes("clear") ) weatherProperties.push("clear");
                        if ( weatherDesc.includes("dust") ) weatherProperties.push("dust");
                        if ( weatherDesc.includes("rain") ) weatherProperties.push("rain");
                        if ( weatherDesc.includes("snow") ) weatherProperties.push("snow");

                        console.log(`Current Weather is ${weatherProperties.toString()}`);

                        let weatherAlert = false;
                        
                        // Get the current time and current period of the day.
                        let timestamp = Math.floor(Date.now() / 1000);
                        let date = moment().tz(data.timeZoneId);
                        let hour = date.format("H");
                        console.log(`Current time at that location is ${hour}`);
    
                        let timeOfDay = "none";
                        if (hour >= 0 && hour <= 6) timeOfDay = "night"; // 12:00am - 6:59am
                        if (hour >= 7 && hour < 9) timeOfDay = "afternoon"; // 7:00am - 8:59am
                        if (hour >= 9 && hour <= 18) timeOfDay = "day"; // 9:00am - 6:59pm
                        if (hour > 18 && hour < 21) timeOfDay = "afternoon"; // 7:00pm - 8:59pm
                        if (hour >= 21 && hour <= 23) timeOfDay = "night"; // 9:00pm - 11:59pm
                        
                        // Get the backdrop
                        let back = resourceManager.getImage(`element_${timeOfDay}`);
                        if (back == null) throw new Error(`Failed to get background for weather card. Background '${timeOfDay}'`);
                        image.composite(back.data, 0, 0);
                    
                        // Get the moons phase
                        let moonPhases = SunCalc.getMoonIllumination(date.toDate());

                        let moonStage = 0;
                        if (moonPhases.phase > 0 && moonPhases.phase < 0.25) { moonStage = 1; }
                        if (moonPhases.phase == 0.25) { moonStage = 2; }
                        if (moonPhases.phase > 0.25 && moonPhases.phase < 0.5) { moonStage = 3; }
                        if (moonPhases.phase == 0.5) { moonStage = 4; }
                        if (moonPhases.phase > 0.5 && moonPhases.phase < 0.75) { moonStage = 5; }
                        if (moonPhases.phase == 0.75) { moonStage = 6; }
                        if (moonPhases.phase > 0.75) { moonStage = 7; }
                        
                        if (timeOfDay == "night") {
                            let moon;
                            if (date.format("MM") == 10) {
                                moon = resourceManager.getImage("element_moon_halloween").data.clone();
                            } else {
                                moon = resourceManager.getImage("element_moon").data.clone();
                            }

                            let mask = resourceManager.getImage("element_moon_mask");
                            moonStage = 2;

                            let northenHemisphere = true;
                            if (weather.coord.lat <= 0) northenHemisphere = false;

                            console.log(`Is ${location} in the northen hemisphere? ${northenHemisphere}`);


                            // Add in the moon
                            moon.mask(mask.data, -(110 * moonStage), 0);
                            if (northenHemisphere == false) moon.data.flip(true, false);
                            image.composite(moon, 340, -15);
                        } else if (timeOfDay == "afternoon") {
                            // Add the afternoon sun
                            let sun;
                            sun = resourceManager.getImage("element_sun_sunset").data.clone();
                            
                            if (weatherProperties.includes("rain") || weatherProperties.includes("mist") || weatherProperties.includes("cloud") ) {
                                sun.opacity(.5);
                            }

                            image.composite(sun, 243, -70);
                        } else if (timeOfDay == "day") {
                            // Add the daytime sun
                            let sun;

                            if (weatherProperties.includes("mist")) {
                                // Misty? Sun won't be too bright.
                            } else {
                                sun = resourceManager.getImage("element_sun_bright");
                            }

                            image.composite(sun.data, 313, -42);
                        }
                        // Add in mist
                        if (weatherProperties.includes("mist")) {
                            let mist = resourceManager.getImage("element_mist").data.clone();
                            mist.opacity(.5);
                            image.composite(mist, 0, 0);
                        }

                        // Add in dust
                        if (weatherProperties.includes("mist") ) {
                            let dust = resourceManager.getImage("element_dust").data.clone();
                            dust.opacity(.5);
                            image.composite(dust, 0, 0);
                        }
                        
                        // Add in the clouds.
                        let cloud = resourceManager.getImage("element_clouds").data.clone();
                        if (weatherProperties.includes("cloud") || weatherProperties.includes("rain")) {
                            if (weatherProperties.includes("rain") || weatherProperties.includes("light")) {
                                cloud.opacity(0.25);
                            } else {
                                cloud.opacity(0.75);
                            }
                            image.composite(cloud, 0, 0);
                        }

                        // Add in rain.
                        let rain = resourceManager.getImage("element_rain").data.clone();
                        if (weatherProperties.includes("rain")) {
                            image.composite(rain, 0, 0);
                        }
                        

                        if (weatherProperties.includes("snow")) {
                            let snow = resourceManager.getImage("element_light_snow");
                            image.composite(snow.data,0,0);
                        }


                        if (timeOfDay == "night") {
                            // If the month is October add bats.
                            if (date.format("MM") == 10) {
                                let bats = resourceManager.getImage("element_bats");
                                image.composite(bats.data, 0, 0);
                            }
                        }

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
								if (err) {
                                    console.log("Jimp failed to generate a buffer");
                                    return reject(err);
                                }
								resolve(buffer);
                            });
                            
                        });
                    }).catch(reject);
                });
            }).catch( err => {
                console.log(`Error getting weather`, err.toString(), reject);
                reject({
                    code: 404,
                    message: "Location not found",
                });
            });
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