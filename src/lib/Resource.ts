
import Canvas from 'canvas';
import path from 'path';

class Resource {
    public id;
    public path;
    public type;
    public data: undefined | Canvas.Image;
    public metadata: { [key: string]: any } = {};

    constructor(id: string, path: string, type: 'image' | 'font'){
        if (arguments.length < 2) throw new Error('Resource must have at least two arguments!');
        
        this.id = id;
        this.path = path;
        this.type = "image";

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
            console.log(`Loading font ${this.id}`, this.metadata, this.path );
            try {
            let font = await Canvas.registerFont(this.path, this.metadata as any);
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

export default Resource;