// Lightweight in-memory EntityManager for auth tests: implements the subset of the TypeORM API
// used by SessionService and MagicLinkService (insert/findOneBy/find/delete/update).
// No real DB driver — the tests are portable (including CI) and fast.
//
// The store is keyed by EntityTarget (the class). Records are plain object clones. The
// FindOperator IsNull() is supported (needed for atomic single-use in MagicLinkService).
import {FindOperator} from "typeorm";

type Row = Record<string, any>;

function valueEquals(a: any, b: any): boolean {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    // Compare bigint ↔ number/string by their string representation (as the DB driver does).
    if (typeof a === "bigint" || typeof b === "bigint") return String(a) === String(b);
    return a === b;
}

export class FakeManager {
    private store = new Map<unknown, Row[]>();
    private seq = new Map<unknown, number>();

    private rows(target: unknown): Row[] {
        if (!this.store.has(target)) this.store.set(target, []);
        return this.store.get(target)!;
    }

    /** The whole table (for inspection in tests: "the DB stores a hash, not the raw sid"). */
    dump(target: unknown): Row[] {
        return this.rows(target).map((r) => ({...r}));
    }

    private matches(row: Row, where: Row): boolean {
        return Object.entries(where).every(([k, cond]) => {
            if (cond instanceof FindOperator) {
                if (cond.type === "isNull") return row[k] === null || row[k] === undefined;
                throw new Error(`FakeManager: unsupported FindOperator "${cond.type}"`);
            }
            return valueEquals(row[k], cond);
        });
    }

    async insert(target: unknown, entity: Row | Row[]) {
        const list = Array.isArray(entity) ? entity : [entity];
        for (const e of list) {
            const row = {...e};
            if (row.id === undefined) {
                const next = (this.seq.get(target) ?? 0) + 1;
                this.seq.set(target, next);
                row.id = next;
            }
            this.rows(target).push(row);
        }
        return {identifiers: [], generatedMaps: [], raw: []} as any;
    }

    async findOneBy(target: unknown, where: Row): Promise<any> {
        return this.rows(target).find((r) => this.matches(r, where)) ?? null;
    }

    async find(target: unknown): Promise<any[]> {
        return this.dump(target);
    }

    async delete(target: unknown, where: Row) {
        const rows = this.rows(target);
        let affected = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
            if (this.matches(rows[i], where)) {
                rows.splice(i, 1);
                affected++;
            }
        }
        return {affected, raw: []} as any;
    }

    async update(target: unknown, where: Row, partial: Row) {
        let affected = 0;
        for (const r of this.rows(target)) {
            if (this.matches(r, where)) {
                Object.assign(r, partial);
                affected++;
            }
        }
        return {affected, raw: [], generatedMaps: []} as any;
    }
}

/** Fake DataSource: SessionService/MagicLinkService only use `.manager`. */
export function fakeDataSource(): {manager: FakeManager} {
    return {manager: new FakeManager()};
}
