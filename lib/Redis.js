const redis = require('redis');
const config = require('../config.js');
const client = redis.createClient(config.servers.redis);

module.exports = client;