// SWC config for vitest: decorator transformation (TypeORM @Entity/@Column) with metadata
// emission. Guarantees correct handling of legacy decorators regardless of the Vite version.
import type {Options as SwcOptions} from "@swc/core";

export const swcAuthOptions: SwcOptions = {
    jsc: {
        parser: {syntax: "typescript", decorators: true},
        transform: {legacyDecorator: true, decoratorMetadata: true},
        target: "es2022",
        keepClassNames: true,
    },
};
