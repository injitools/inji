// Layering hygiene: the DTO/validation engine (@injitools/contract) must stay free of server
// dependencies. It is the shared base of the framework (core/db/auth all build on it), so a
// server import here would create a dependency cycle and pull typeorm/express into every consumer.
// ORM binding is expressed with @OrmLink + an opaque `db` value (see RequestDto/ResponseDto), so no
// typeorm import is ever needed in this package.
//
// This test is a standing regression guard: it fails if an import of a server dependency
// (typeorm, @injitools/db, @injitools/auth, express, got) leaks into the @injitools/contract sources.
// It complements graph.test.ts (which checks the BUILT dist graph) — here we catch the leak
// at the SOURCE level, before the build: closer to where it was introduced and with a clear file name.
import {test, expect} from "vitest";
import {readdirSync, readFileSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(testsDir, "../src");

// Server dependencies that have no place in the DTO/validation layer.
const FORBIDDEN = ["typeorm", "@injitools/db", "@injitools/auth", "express", "got", "zod-openapi"];

/** All contract source .ts files (recursively). */
function collectSources(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) out.push(...collectSources(full));
        else if (name.endsWith(".ts")) out.push(full);
    }
    return out;
}

/** Bare specifiers from import/export ... from "x" and side-effect import "x". */
function bareSpecifiers(code: string): string[] {
    const specs: string[] = [];
    const patterns = [
        /(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g,
        /\bimport\s*["']([^"']+)["']/g,
        /\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) specs.push(m[1]);
    }
    return specs;
}

test("no @injitools/contract source imports a server dependency", () => {
    const offenders: string[] = [];
    for (const file of collectSources(srcDir)) {
        const specs = bareSpecifiers(readFileSync(file, "utf8"));
        for (const spec of specs) {
            // a specifier is forbidden if it is the package itself or a subpath of it (e.g. "@injitools/db/x")
            const hit = FORBIDDEN.find((f) => spec === f || spec.startsWith(f + "/"));
            if (hit) offenders.push(`${path.relative(srcDir, file)} → "${spec}"`);
        }
    }
    expect(offenders, `contract imports a server dependency:\n${offenders.join("\n")}`).toEqual([]);
});
