#!/usr/bin/env node
import path from "node:path";

import {runInit} from "./commands/init.js";

const HELP = `inji — the Inji framework CLI

Usage:
  inji init [name] [--force]   create the monorepo skeleton (domain + apps + frontend)
  inji help                    show this help

Examples:
  inji init my-app             create a project in ./my-app
  inji init .                  scaffold into the current directory

What's inside the skeleton (API-first, app-centric):
  domain             business core ONLY: TypeORM entities, DataSource, domain services
                     (NewsService/UserService), authentication (cookie/scrypt) — no controllers.
                     The shared @app/domain package, reused by every app via its services.
  apps/client        client contour — api + its web frontend, side by side:
    client-api       self-contained app: its OWN controllers + DTOs (public projections),
                     OpenAPI, offline codegen — delegates to domain services.
    client-web       client-facing app (React+Vite): news, login, registration
  apps/admin         admin contour — api + its web frontend, side by side:
    admin-api        self-contained app: its OWN controllers + DTOs (full/admin projections),
                     admin-only auth, news CRUD, user list.
    admin-web        admin panel (shadcn/ui + React): users, news CRUD
  apps/publisher     cron worker: schedules the domain NewsService.publishDue() operation.

Frontends are typed with interfaces generated from OpenAPI: npm run gen
`

function main(argv: string[]) {
    const [command, ...rest] = argv

    switch (command) {
        case "init": {
            const force = rest.includes("--force")
            const positional = rest.filter(a => !a.startsWith("--"))
            const nameArg = positional[0] ?? "inji-app"
            const targetDir = path.resolve(process.cwd(), nameArg)
            // Project name is always the last path segment (valid for package.json).
            const projectName = path.basename(targetDir)
            runInit({targetDir, projectName, force})
            break
        }
        case "help":
        case "--help":
        case "-h":
        case undefined:
            console.log(HELP)
            break
        default:
            console.error(`[inji] Unknown command: ${command}\n`)
            console.log(HELP)
            process.exit(1)
    }
}

main(process.argv.slice(2))
