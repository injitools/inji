// End-to-end verification of the `inji init` skeleton against the LOCAL framework packages.
// No npm registry and NO running Postgres are needed (codegen derives types offline via
// TypeORM buildMetadatas). This is the "does the template actually build" gate for CI/dev.
//
//   npm run verify:skeleton            # backend: scaffold → install → tsc -b → gen → schema diff
//   npm run verify:skeleton -- --full  # also install + typecheck the frontends (react/vite — heavy)
//   npm run verify:skeleton -- --keep  # keep the temp project for inspection
//
// Steps:
//   1. build @injitools/* and `npm pack` them into the scaffold's vendor/ (absolute file: tarballs —
//      the only form npm reliably accepts on Windows; --install-links copies them as real deps so a
//      single hoisted `typeorm` is used, avoiding "No metadata for ..." from duplicate copies).
//   2. `inji init` the real template into a temp dir.
//   3. rewrite every @injitools/* dependency pin → file:<abs vendor tarball>.
//   4. `npm install --install-links`.
//   5. `tsc -b` (domain + apps) — the real typecheck (not the IDE's template false-positives).
//   6. `npm run gen` — regenerate schema.gen.ts offline (no Postgres).
//   7. diff the regenerated schema.gen.ts against the copies committed in the template; drift fails.

import {execSync} from "node:child_process";
import {mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync, cpSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "../..");
const TEMPLATE = join(REPO, "packages/cli/templates/skeleton");
const CLI = join(REPO, "packages/cli/dist/cli.js");
const PKGS = ["contract", "core", "db", "auth"];
const args = process.argv.slice(2);
const FULL = args.includes("--full");
const KEEP = args.includes("--keep");

const sh = (cmd, cwd) => {
    console.log(`\n$ ${cmd}${cwd ? `   (cwd: ${cwd})` : ""}`);
    execSync(cmd, {cwd: cwd ?? REPO, stdio: "inherit"});
};

function rewriteInjitoolsDeps(pkgJsonPath, tarballs) {
    if (!existsSync(pkgJsonPath)) return false;
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    let touched = false;
    for (const field of ["dependencies", "devDependencies"]) {
        const deps = pkg[field];
        if (!deps) continue;
        for (const name of Object.keys(deps)) {
            if (name.startsWith("@injitools/")) {
                const short = name.slice("@injitools/".length);
                const tgz = tarballs[short];
                if (!tgz) throw new Error(`no packed tarball for ${name}`);
                deps[name] = `file:${tgz}`;
                touched = true;
            }
        }
    }
    if (touched) writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
    return touched;
}

function findPackageJsons(dir, out = []) {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
        if (e.name === "node_modules" || e.name === ".git") continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) findPackageJsons(p, out);
        else if (e.name === "package.json") out.push(p);
    }
    return out;
}

const appDir = mkdtempSync(join(tmpdir(), "inji-verify-"));
let failed = false;
try {
    // 1. build + pack the local packages
    sh("npm run build");
    const proj = join(appDir, "app");

    // 2. scaffold the real template
    sh(`node "${CLI}" init "${proj}"`);

    // pack into <proj>/vendor (npm pack does not create the destination dir)
    const vendor = join(proj, "vendor");
    mkdirSync(vendor, {recursive: true});
    sh(`npm pack ${PKGS.map((p) => `-w @injitools/${p}`).join(" ")} --pack-destination "${vendor}"`);
    const tarballs = {};
    for (const f of readdirSync(vendor)) {
        const m = f.match(/^injitools-(.+?)-\d.*\.tgz$/);
        if (m) tarballs[m[1]] = join(vendor, f).replace(/\\/g, "/");
    }
    for (const p of PKGS) if (!tarballs[p]) throw new Error(`npm pack produced no tarball for @injitools/${p}`);

    // 3a. rewrite @injitools/* direct pins → file: tarballs, in every workspace package.json
    for (const pj of findPackageJsons(proj)) rewriteInjitoolsDeps(pj, tarballs);

    // 3b. force TRANSITIVE @injitools/* (e.g. core → contract) to the same tarballs via root
    // `overrides` — otherwise npm resolves them from the registry (E404 / not published).
    const rootPkgPath = join(proj, "package.json");
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
    rootPkg.overrides = rootPkg.overrides ?? {};
    for (const p of PKGS) rootPkg.overrides[`@injitools/${p}`] = `file:${tarballs[p]}`;
    writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");

    // 4. install (backend workspaces only unless --full)
    const scope = FULL ? "" : "-w domain -w apps/client/client-api -w apps/admin/admin-api -w apps/publisher";
    sh(`npm install --install-links --no-audit --no-fund ${scope}`, proj);

    // 5. typecheck domain + apps (the real tsc -b)
    sh(`npx tsc -b`, proj);
    if (FULL) {
        sh(`npm run typecheck -w @app/client-web`, proj);
        sh(`npm run typecheck -w @app/admin-web`, proj);
    }

    // 6. regenerate schema.gen.ts offline (no Postgres). codegen still CONSTRUCTS the DataSource
    // (reads DB_MAIN_* to build config) even though it never connects — so a .env is required.
    // The template's .env.example carries concrete dummy values; connecting never happens.
    cpSync(join(proj, ".env.example"), join(proj, ".env"));
    sh(`npm run gen`, proj);

    // 7. diff regenerated schema against the copies committed in the template
    console.log("\n=== schema.gen.ts drift check (regenerated vs committed template) ===");
    const targets = [
        "apps/client/client-web/src/api/schema.gen.ts",
        "apps/admin/admin-web/src/api/schema.gen.ts",
    ];
    for (const rel of targets) {
        const gen = readFileSync(join(proj, rel), "utf8");
        const committed = existsSync(join(TEMPLATE, rel)) ? readFileSync(join(TEMPLATE, rel), "utf8") : "";
        if (gen === committed) {
            console.log(`  OK  ${rel}`);
        } else {
            failed = true;
            console.log(`  DRIFT  ${rel} — regenerated output differs from the committed template:`);
            try {
                execSync(`git --no-pager diff --no-index -- "${join(TEMPLATE, rel)}" "${join(proj, rel)}"`, {stdio: "inherit"});
            } catch { /* git diff exits 1 on difference */ }
        }
    }

    if (KEEP) {
        // keep a copy of the freshly generated schema for syncing the template
        const out = join(REPO, ".verify-skeleton-gen");
        cpSync(join(proj, "apps/client/client-web/src/api/schema.gen.ts"), join(out, "web.schema.gen.ts"));
        cpSync(join(proj, "apps/admin/admin-web/src/api/schema.gen.ts"), join(out, "admin.schema.gen.ts"));
        console.log(`\nRegenerated schema copied to ${out}`);
    }

    console.log(`\n${failed ? "✗ verify:skeleton FAILED (schema drift)" : "✓ verify:skeleton OK — template builds, gen is offline & in sync"}`);
    console.log(`  temp project: ${proj}${KEEP ? " (kept)" : ""}`);
} finally {
    if (!KEEP) rmSync(appDir, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
