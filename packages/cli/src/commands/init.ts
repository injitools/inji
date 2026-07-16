import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// dist/commands/init.js → ../../templates/skeleton
const SKELETON_DIR = path.resolve(__dirname, "../../templates/skeleton")

// Special names: stored in templates without a leading dot so npm doesn't ignore them.
const FILE_NAME_MAP: Record<string, string> = {
    "gitignore": ".gitignore",
    "env.example": ".env.example",
}

export type InitOptions = {
    targetDir: string
    projectName: string
    force: boolean
}

export function runInit(opts: InitOptions) {
    const {targetDir, projectName, force} = opts

    if (!fs.existsSync(SKELETON_DIR)) {
        console.error(`[inji] Templates directory not found: ${SKELETON_DIR}`)
        process.exit(1)
    }

    if (fs.existsSync(targetDir)) {
        const entries = fs.readdirSync(targetDir)
        if (entries.length > 0 && !force) {
            console.error(`[inji] Directory ${targetDir} is not empty. Use --force to continue.`)
            process.exit(1)
        }
    } else {
        fs.mkdirSync(targetDir, {recursive: true})
    }

    const created: string[] = []
    copyDir(SKELETON_DIR, targetDir, {projectName}, created)

    console.log(`\n[inji] Monorepo created at: ${targetDir}`)
    console.log(`[inji] Files: ${created.length}\n`)
    console.log("Next steps:")
    console.log(`  cd ${path.relative(process.cwd(), targetDir) || "."}`)
    console.log("  npm install")
    console.log("  cp .env.example .env                     # shared .env at the root (Postgres access + NODE_ENV=dev)")
    console.log("  npm run seed                             # admin + demo news — PRINTS a generated admin password (shown once)")
    console.log("  npm run dev                              # client-api :3300 · admin-api :3301 · publisher · web :5173 · admin :5174\n")
}

function copyDir(srcDir: string, destDir: string, vars: { projectName: string }, created: string[]) {
    fs.mkdirSync(destDir, {recursive: true})
    for (const entry of fs.readdirSync(srcDir, {withFileTypes: true})) {
        const srcPath = path.join(srcDir, entry.name)
        const mappedName = FILE_NAME_MAP[entry.name] ?? entry.name
        const destPath = path.join(destDir, mappedName)

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, vars, created)
        } else {
            let content = fs.readFileSync(srcPath, "utf8")
            content = content.replaceAll("__PROJECT_NAME__", vars.projectName)
            fs.writeFileSync(destPath, content)
            created.push(destPath)
        }
    }
}
