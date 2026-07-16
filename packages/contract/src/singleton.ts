/**
 * Process-wide slots for the module-level registries.
 *
 * Why this exists. The DTO and route registries are module-level WeakMaps. If a package carrying
 * them ends up duplicated in node_modules, each copy gets its OWN registry: a decorator applied
 * through copy A becomes invisible to a reader in copy B — with no error. Here that is not
 * cosmetic. A guard is registered by a decorator (@RequireAdmin → Middleware → RoutesStorage) and
 * read by the router (InjiRouter). Split the registry and the guard never reaches the route: the
 * endpoint answers 200 to anyone, the app looks healthy, and nothing appears in the logs.
 *
 * The layout cannot be relied upon to prevent this. npm duplicates a package for reasons that have
 * nothing to do with it — one conflicting transitive dependency elsewhere in a monorepo (a package
 * pinning a different major of some shared library) is enough to push this one deep and clone it.
 * Aligning the @injitools/* ranges does not help, because the conflict need not involve them.
 *
 * So every copy claims the same globalThis slot instead:
 *   • same version    → they share one registry, and the duplication is harmless.
 *   • different versions → we throw at import time, because silently merging records whose shape
 *     may differ is worse than refusing to start. For an authorization guard, failing loudly is
 *     the only safe direction.
 *
 * zod v4 does exactly this for its own global registry — which is why two copies of zod@4 still
 * agree on `.meta({id})`.
 */

type Slot<T> = {version: string; value: T};

/**
 * Returns the process-wide value for `name`, creating it on first use.
 *
 * @param name    stable identity of the slot — must not encode the version.
 * @param version the claiming copy's package version; a mismatch between copies is fatal.
 * @param create  builds the value for the first copy to arrive.
 */
export function sharedSingleton<T>(name: string, version: string, create: () => T): T {
    const key = Symbol.for(`injitools.${name}`);
    const registry = globalThis as unknown as Record<symbol, Slot<T> | undefined>;
    const existing = registry[key];

    if (existing) {
        if (existing.version !== version) {
            throw new Error(
                `Two different versions of the Inji framework are loaded in the same process ` +
                `(${existing.version} and ${version}), so "${name}" cannot be shared between them.\n` +
                `Refusing to start: each copy would keep its own registry, and a decorator applied ` +
                `through one copy would be invisible to the other. An authorization guard registered ` +
                `that way never reaches the router, and the endpoint answers without it.\n` +
                `Find the duplicate with:  npm ls @injitools/core @injitools/contract\n` +
                `It is usually an unrelated dependency conflict pushing a copy deeper into ` +
                `node_modules. Align the versions (a clean reinstall, or an "overrides" entry).`,
            );
        }
        return existing.value;
    }

    const slot: Slot<T> = {version, value: create()};
    registry[key] = slot;
    return slot.value;
}
