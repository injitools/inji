import {ValueTransformer} from 'typeorm';

export class HexTransformer implements ValueTransformer {
    constructor(public prefix = '0x') {
    }

    from(dbValue: Buffer | null): string | null {
        if (dbValue === null) return null;
        return this.prefix + dbValue.toString('hex');
    }

    to(entityValue: string | null): Buffer | null {
        if (entityValue === null) return null;

        if (this.prefix.length && entityValue.startsWith(this.prefix)) {
            entityValue = entityValue.slice(this.prefix.length);
        }

        return Buffer.from(entityValue, 'hex');
    }
}
