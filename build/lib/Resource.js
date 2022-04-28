"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const canvas_1 = __importDefault(require("canvas"));
class Resource {
    constructor(id, path, type) {
        this.metadata = {};
        if (arguments.length < 2)
            throw new Error('Resource must have at least two arguments!');
        this.id = id;
        this.path = path;
        this.type = "image";
        if (arguments.length >= 3) {
            if (type.toLowerCase() == "image" || type.toLowerCase() == "font") {
                this.type = type.toLowerCase();
            }
        }
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.type == "image") {
                let image = yield canvas_1.default.loadImage(this.path);
                this.data = image;
                return image;
            }
            else if (this.type == "font") {
                console.log(`Loading font ${this.id}`, this.metadata, this.path);
                try {
                    let font = yield canvas_1.default.registerFont(this.path, this.metadata);
                    return font;
                }
                catch (e) {
                    console.log("Failed to loaad font :<", e);
                }
            }
            else {
                throw new Error(`Unrecognized resource type '${this.type}'`);
            }
        });
    }
    isImage() {
        return (this.type == "image" ? true : false);
    }
    isFont() {
        return (this.type == "font" ? true : false);
    }
}
exports.default = Resource;
