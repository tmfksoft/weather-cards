const Jimp = require('jimp');
const Canvas = require('canvas');
const path = require('path');

class Resource {
    constructor(id, path, type){
        if (arguments.length < 2) throw new Error('Resource must have at least two arguments!');
        
        this.id = id;
        this.path = path;
        this.type = "image";
        this.data = null;
        this.metadata;

        if (arguments.length >= 3) {
            if (type.toLowerCase() == "image" || type.toLowerCase() == "font") {
                this.type = type.toLowerCase();
            }
        }
    }
    async load() {
        if (this.type == "image") {
            let image = await Canvas.loadImage(this.path);
            this.data = image;
            return image;
        } else if (this.type == "font") {
            console.log(`Loading font ${this.id}`, this.metadata, this.path, path.join(__dirname,'..', this.path) );
            try {
            let font = await Canvas.registerFont(path.join(__dirname,'..', this.path), this.metadata);
            this.data = font;
            return font;
            } catch (e) {
                console.log("Failed to loaad font :<", e);
            }
            

        } else {
            throw new Error(`Unrecognized resource type '${this.type}'`);
        }
    }
    isImage() {
        return (this.type == "image" ? true : false);
    }
    isFont() {
        return (this.type == "font" ? true : false);
    }
}
module.exports = Resource;