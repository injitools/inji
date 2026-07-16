// Environment detection and explicit loading of .env files.
// Unlike the original, loading is extracted into the loadEnv() function and is NOT performed
// as a side effect of import — call it at the application's entry point.

import fs from "fs";

type EnvName = 'development' | 'test' | 'production' | 'build' | string

if (process.env.NODE_TEST_CONTEXT) {
    process.env.NODE_ENV = 'test'
}

export let envName: string = process.env.NODE_ENV || 'production'

export const isBuild = () => envName === "build";
export const isTest = () => envName === "test";
export const isDev = () => envName === "development";
export const isProd = () => envName === "production";

function mapEnvToSuffix(env: EnvName): string {
    switch (env) {
        case 'development':
            return 'dev'
        case 'test':
            return 'test'
        case 'production':
            return 'prod'
        case 'build':
            return 'build'
        default:
            return env
    }
}

function tryLoadEnvFile(path: string) {
    if (fs.existsSync(path)) {
        process.loadEnvFile(path)
        console.log(`[env] loaded ${path}`)
    }
}

/**
 * Loads .env.<suffix> (based on NODE_ENV), then the shared .env.
 * Missing files are not an error.
 */
export function loadEnv() {
    const suffix = mapEnvToSuffix(process.env.NODE_ENV || 'production')
    if (suffix && suffix !== 'env') {
        tryLoadEnvFile(`.env.${suffix}`)
    }
    tryLoadEnvFile(`.env`)
    envName = process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    return envName
}
