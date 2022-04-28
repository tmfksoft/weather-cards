"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Resource_1 = __importDefault(require("./Resource"));
const path_1 = __importDefault(require("path"));
class ResourceManager {
    constructor() {
        this.loaded = false;
        this.resources = [];
    }
    addResource(id, resourcePath, type, metadata) {
        console.log(`Adding Resource ${id}`, path_1.default.join(__dirname, resourcePath));
        if (arguments.length < 2)
            throw new Error('Resource must have at least two arguments!');
        if (this.getResource(id, type) != null)
            throw new Error('Resource of that type and ID already exists!');
        let resource = null;
        if (arguments.length == 2) {
            resource = new Resource_1.default(id, resourcePath, type);
        }
        else {
            resource = new Resource_1.default(id, resourcePath, type);
        }
        if (typeof metadata !== "undefined") {
            resource.metadata = metadata;
        }
        this.resources.push(resource);
        if (this.loaded)
            resource.load();
    }
    addFont(id, path, metadata) {
        return this.addResource(id, path, "font", metadata);
    }
    addImage(id, path) {
        return this.addResource(id, path, "image");
    }
    getResource(id, type) {
        if (arguments.length < 1)
            throw new Error('Missing parameters!');
        for (let res of this.resources) {
            if (arguments.length == 2) {
                if (res.id.toLowerCase() == id.toLowerCase() && res.type.toLowerCase() == type.toLowerCase())
                    return res;
            }
            else {
                if (res.id.toLowerCase() == id.toLowerCase())
                    return res;
            }
        }
        return null;
    }
    getImage(id) {
        return this.getResource(id, "image");
    }
    getFont(id) {
        return this.getResource(id, "font");
    }
    loadResources() {
        let promises = [];
        for (let res of this.resources) {
            if (res.data == null) {
                promises.push(res.load());
            }
        }
        return Promise.all(promises)
            .then(resources => {
            console.log(`Loaded ${resources.length} resources.`);
            return resources;
        });
    }
}
exports.default = ResourceManager;
