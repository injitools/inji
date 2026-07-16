import Big from "big.js";
import {ValueTransformer} from "typeorm";

export class BigTransformer implements ValueTransformer {
    public to(data: Big | null | string | undefined): string | null {
        if (data instanceof Big) {
            return data.toFixed(18);
        }
        return data
    }

    public from(data: string | null): Big | null {
        if (data === null) {
            return data as null
        }
        return new Big(data)
    }
}
