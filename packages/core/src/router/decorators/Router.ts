import RoutesStorage from "../storages/RoutesStorage.js";
import {trimSlashes} from "../../tools/String.js";

export default function Router(basePath = ""): ClassDecorator {
    return target => {
        RoutesStorage.register(target, {
            path: trimSlashes(basePath),
        })
    }
}
