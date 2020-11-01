config = {
    "servers": {
        "hapi": {
            "host": "0.0.0.0",
            "port": process.env.PORT
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
		"weather": process.env.OWM_KEY,
    		"google_maps": process.env.GMAP_KEY,
	}
};
module.exports = config;
