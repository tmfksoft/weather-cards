"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const vault_config_1 = __importDefault(require("vault-config"));
const client = (0, redis_1.createClient)(Object.assign({}, vault_config_1.default.get('servers.redis')));
client.connect();
exports.default = client;
