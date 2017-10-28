const Jimp = require('jimp');
class Resource {
    constructor(id, path, type){
        if (arguments.length < 2) throw new Error('Resource must have at least two arguments!');
        
        this.id = id;
        this.path = path;
        this.type = "image";
        this.data = null;
        if (arguments.length >= 3) {
            if (type.toLowerCase() == "image" || type.toLowerCase() == "font") {
                this.type = type.toLowerCase();
            }
        }
    }
    load() {
        if (this.type == "image") {
            return Jimp.read(this.path).then( image => {
                this.data = image;
                return this;
            });
        } else if (this.type == "font") {
            return Jimp.loadFont(this.path).then( fnt => {
                this.data = fnt;
                return this;
            });
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