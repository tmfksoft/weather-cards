// This is the default "Production" Config
// This is used by Heroku or Dokku to run the app out of the box with little setup.
config = {
    "servers": {
        "hapi": {
            "host": "0.0.0.0",
            "port": process.env.PORT || 5000
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
