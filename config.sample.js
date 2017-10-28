config = {
    "servers": {
        "hapi": {
            "host": "0.0.0.0",
            "port": 5034
        },
        "redis": {
            "host": "127.0.0.1",
            "port": 6379
        }
	},
	"general": {
		"ratelimit": 50,
		"trustedProxies": [
			"127.0.0.1"
		]
	},
	"logging":{
		"format":"[%date%] %level% %text%",
		"date-format":"h:MM TT mmmm d, yyyy"
	},
	"dev": true,
	"keys":{
		"weather":"OpenWeatherMap API Key",
        "google_maps": "Google Maps Timezone API Key",
	}
};
module.exports = config;