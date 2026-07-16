// Application runtime utilities: environment and config.
// Extracted into a separate subpath (@injitools/core/runtime) because they concern the process
// and configuration, not the router itself.

export {
    envName,
    isBuild,
    isTest,
    isDev,
    isProd,
    loadEnv,
} from "./config/env.js";

export {
    env,
    getUsedEnv,
    flushUsedEnv,
    default as Config,
} from "./config/config.js";

export {default as MPeriods} from "./tools/MPeriods.js";
export {default as Periods} from "./tools/Periods.js";
