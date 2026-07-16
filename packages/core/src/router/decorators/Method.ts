import RoutesStorage, {HttpMethod} from "../storages/RoutesStorage.js";
import {trimSlashes} from "../../tools/String.js";

function Method(method: HttpMethod, path = ""): MethodDecorator {
    return (target, propertyKey: string) => {
        RoutesStorage.addMethod(target.constructor, propertyKey, {
            method,
            path: trimSlashes(path || propertyKey)
        })
    }
}

export const Get = (path = "") => Method("get", path);
export const Post = (path = "") => Method("post", path);
export const Put = (path = "") => Method("put", path);
export const Patch = (path = "") => Method("patch", path);
export const Delete = (path = "") => Method("delete", path);
