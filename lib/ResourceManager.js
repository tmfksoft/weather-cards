const Resource = require('./Resource.js');

class ResourceManager {
    constructor() {
        this.resources = [];
        this.loaded = false; // If we've already loaded then we'll auto load new resources
    }
    addResource(id, path, type, metadata) {
        if (arguments.length < 2) throw new Error('Resource must have at least two arguments!');

        if (this.getResource(id, type) != null) throw new Error('Resource of that type and ID already exists!');
        let resource = null;
        if (arguments.length == 2) {
            resource = new Resource(id, path);
        } else {
            resource = new Resource(id, path, type);
        }
        if (typeof metadata !== "undefined") {
            resource.metadata = metadata;
        }
        this.resources.push(resource);
        if (this.loaded) resource.load();
    }

    addFont(id, path, metadata) {
        return this.addResource(id, path, "font", metadata);
    }
    addImage(id, path) {
        return this.addResource(id, path, "image");
    }

    getResource(id, type) {
        if (arguments.length < 1) throw new Error('Missing parameters!');
        for (let res of this.resources) {
            if (arguments.length == 2) {
                if (res.id.toLowerCase() == id.toLowerCase() && res.type.toLowerCase() == type.toLowerCase()) return res;
            } else {
                if (res.id.toLowerCase() == id.toLowerCase()) return res;
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
        .then( resources => {
            console.log(`Loaded ${resources.length} resources.`);
            return resources;
        })
    }
}
module.exports = new ResourceManager();