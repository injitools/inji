import {ZodType} from "zod";

import {isBuild} from "./env.js";

const usedEnv = new Set<string>();

/**
 * Type-safe reading of an environment variable with Zod validation/coercion.
 * Overloads: env(name, schema) — required; env(name, default, schema) — with a default.
 */
export function env<T>(name: string, schema: ZodType<T>,): T;
export function env<T>(name: string, defaultValue: T, schema: ZodType<T>,): T;
export function env(name: string, ...args: any[]): unknown {
    usedEnv.add(name);

    const hasDefault = args[1] !== undefined;
    const schema: ZodType = hasDefault ? args[1]! : (args[0] as ZodType);

    // BUILD MODE: don't touch process.env and don't call schema.parse
    if (isBuild()) {
        return hasDefault ? args[0] : undefined as unknown
    }

    const raw = process.env[name];

    if (raw === undefined || raw === '') {
        if (!hasDefault) {
            throw new Error(`Missing required env variable: ${name}`);
        }
        return schema.parse(args[0]);
    }

    return schema.parse(raw);
}

export function getUsedEnv(): string[] {
    return Array.from(usedEnv);
}

export function flushUsedEnv() {
    usedEnv.clear();
}

export default class Config {
    private static configs: { [key: string]: unknown } = {};

    static set<K extends string, V>(key: K, value: V): V;
    static set<T extends Record<string, unknown>>(values: T): T;
    static set(keyOrValues: string | Record<string, unknown>, value?: unknown) {
        if (typeof keyOrValues !== "string") {
            Object.assign(this.configs, keyOrValues)
            return keyOrValues
        }
        return this.configs[keyOrValues] = value;
    }

    static get<T = unknown>(key: string): T {
        return this.configs[key] as T
    }
}
