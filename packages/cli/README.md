# @injitools/cli

CLI for the **Inji** framework. Scaffolds a ready-to-run monorepo (`inji init`) built around an
API-first approach: a shared `domain` (DTOs + validation + TypeORM entities + OpenAPI), backend
processes (client-api, admin-api, publisher), and two React + Vite frontends (a public app and a
shadcn/ui admin panel).

Part of the [Inji](../../README.md) monorepo.

## Usage

```bash
npx @injitools/cli init my-app
cd my-app
npm install
cp .env.example .env   # Postgres access
npm run seed           # admin/admin12345 + demo data
npm run dev
```

Use `--force` to scaffold into a non-empty directory.

## License

MIT
