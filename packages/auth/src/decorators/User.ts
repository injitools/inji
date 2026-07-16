import {Meta} from "@injitools/core";

/** Parameter decorator: pulls the user from req.meta.user (populated by auth-middleware). */
export default function User(): ParameterDecorator {
    return Meta('user')
}
