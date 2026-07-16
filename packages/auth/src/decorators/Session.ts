import {Meta} from "@injitools/core";

/** Parameter decorator: pulls the session from req.meta.session (populated by cookie-auth). */
export default function Session(): ParameterDecorator {
    return Meta('session')
}
