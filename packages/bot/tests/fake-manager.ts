// Lightweight in-memory EntityManager for the TypeORM storage tests: implements the subset of
// the TypeORM API used by MultiBotTypeOrmProvider (findOneBy/upsert/save). No real DB driver —
// the tests are portable (including CI) and fast.
//
// The store is keyed by entity class; `save(instance)` resolves the class from the instance.
// Generated ids are simulated for entities with an `id` column; composite-key entities are
// written through `upsert(target, row, conflictPaths)`.
type Row = Record<string, any>;

export class FakeManager {
    private store = new Map<unknown, Row[]>();
    private seq = new Map<unknown, number>();

    private rows(target: unknown): Row[] {
        if (!this.store.has(target)) this.store.set(target, []);
        return this.store.get(target)!;
    }

    /** The whole table, for inspection in tests. */
    dump(target: unknown): Row[] {
        return this.rows(target).map((r) => ({...r}));
    }

    private matches(row: Row, where: Row): boolean {
        return Object.entries(where).every(([k, v]) => row[k] === v);
    }

    async findOneBy(target: unknown, where: Row): Promise<any> {
        const row = this.rows(target).find((r) => this.matches(r, where));
        if (!row) return null;
        const entity = Object.create((target as any).prototype);
        return Object.assign(entity, row);
    }

    async upsert(target: unknown, row: Row, conflictPaths: string[]) {
        const key = Object.fromEntries(conflictPaths.map((p) => [p, row[p]]));
        const existing = this.rows(target).find((r) => this.matches(r, key));
        if (existing) {
            Object.assign(existing, row);
        } else {
            this.rows(target).push({...row});
        }
        return {identifiers: [], generatedMaps: [], raw: []} as any;
    }

    async save(entity: Row): Promise<any> {
        const target = entity.constructor;
        const rows = this.rows(target);
        if (entity.id === undefined || entity.id === null) {
            const next = (this.seq.get(target) ?? 0) + 1;
            this.seq.set(target, next);
            entity.id = next;
            rows.push({...entity});
        } else {
            const idx = rows.findIndex((r) => r.id === entity.id);
            if (idx >= 0) rows[idx] = {...entity};
            else rows.push({...entity});
        }
        return entity;
    }
}
