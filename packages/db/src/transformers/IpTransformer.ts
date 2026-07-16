import {ValueTransformer} from "typeorm";

export class IpTransformer implements ValueTransformer {
    public to(data: string | null): number {
        if (data === null) return null
        return data.split('.').map((octet, index, array) => {
            return parseInt(octet) * Math.pow(256, (array.length - index - 1))
        }).reduce((prev, curr) => {
            return prev + curr;
        })
    }

    public from(value: number | null): string {
        if (value === null) return null
        return [
            (value >> 24) & 0xff,
            (value >> 16) & 0xff,
            (value >> 8) & 0xff,
            value & 0xff
        ].join('.');
    }
}
