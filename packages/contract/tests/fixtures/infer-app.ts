// Fixture for checking Infer/InferInput: a DTO with the full set of branches — primitives with
// coercion (number/bigint/boolean/Date), string transform (UrlLike), optional, a custom
// validator (validation), nested @DtoLink and @DtoLinkArray.
//
// Field types are declared in the code (and NOT duplicated) — Vite/Oxc emits design:type
// (see vitest.config.ts), so runtime schema generation works, and Infer<typeof …>
// derives the structure from the same declared types. The single source of truth is the class itself.
import {Dto, DtoProperty, DtoLink, DtoLinkArray, UrlLike} from "@injitools/contract";
import {z} from "zod";

@Dto()
export class GeoDto {
    @DtoProperty() lat: number;
    @DtoProperty() lon: number;
}

@Dto()
export class PlaceDto {
    @DtoProperty() title: string;          // z.string()           string  → string
    @DtoProperty() site: UrlLike;          // UrlLikeSchema        string  → UrlLike
    @DtoProperty() openedAt: Date;         // z.coerce.date()      unknown → Date
    @DtoProperty() rating: number;         // z.coerce.number()    unknown → number
    @DtoProperty() verified: boolean;      // boolFromQueryOrJson  unknown → boolean
    @DtoProperty() visits: bigint;         // z.coerce.bigint()    unknown → bigint
    @DtoProperty({optional: true}) note?: string;                 // .optional()
    @DtoProperty({validation: z.array(z.string())}) tags: string[]; // custom validator
    @DtoLink(GeoDto) geo: GeoDto;          // nested DTO
    @DtoLinkArray(GeoDto) nearby: GeoDto[]; // array of nested DTOs
}
