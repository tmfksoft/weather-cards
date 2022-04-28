import Resource from "./Resource";
import path from 'path';

class ResourceManager {
    private loaded: boolean = false;
    private resources: Resource[] = [];

    constructor() {
    }

    addResource(id: string, resourcePath: string, type: 'image' | 'font', metadata?: { [ key: string ]: any }) {

        console.log(`Adding Resource ${id}`, path.join(__dirname, resourcePath));

        if (arguments.length < 2) throw new Error('Resource must have at least two arguments!');

        if (this.getResource(id, type) != null) throw new Error('Resource of that type and ID already exists!');


        let resource = null;
        if (arguments.length == 2) {
            resource = new Resource(id, resourcePath, type);
        } else {
            resource = new Resource(id, resourcePath, type);
        }
        if (typeof metadata !== "undefined") {
            resource.metadata = metadata;
        }
        this.resources.push(resource);
        if (this.loaded) resource.load();
    }

    addFont(id: string, path: string, metadata?: { [key: string]: any }) {
        return this.addResource(id, path, "font", metadata);
    }
    addImage(id: string, path: string) {
        return this.addResource(id, path, "image");
    }

    getResource(id: string, type: 'image' | 'font') {
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
    getImage(id: string) {
        return this.getResource(id, "image");
    }
    getFont(id: string) {
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
export default ResourceManager;