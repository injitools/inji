// issue #10 — coverage for dataToDto: plain object → DTO class instance, including recursive
// materialization of nested @DtoLink and @DtoLinkArray into real class instances.
import {describe, test, expect} from "vitest";
import {dataToDto} from "@injitools/contract";
import {PlaceDto, GeoDto} from "./fixtures/infer-app.js";

const plain = {
    title: "Cafe",
    site: "example.com",
    openedAt: new Date("2020-01-02"),
    rating: 4.5,
    verified: true,
    visits: 1000n,
    tags: ["coffee"],
    geo: {lat: 1, lon: 2},
    nearby: [{lat: 3, lon: 4}, {lat: 5, lon: 6}],
};

describe("dataToDto", () => {
    test("returns a DTO class instance with the primitives carried over", () => {
        const dto = dataToDto(PlaceDto, plain) as PlaceDto;
        expect(dto).toBeInstanceOf(PlaceDto);
        expect(dto.title).toBe("Cafe");
        expect(dto.rating).toBe(4.5);
        expect(dto.visits).toBe(1000n);
        expect(dto.tags).toEqual(["coffee"]);
    });

    test("a nested @DtoLink is materialized into a class instance", () => {
        const dto = dataToDto(PlaceDto, plain) as PlaceDto;
        expect(dto.geo).toBeInstanceOf(GeoDto);
        expect(dto.geo.lat).toBe(1);
        expect(dto.geo.lon).toBe(2);
    });

    test("@DtoLinkArray materializes each element into a class instance", () => {
        const dto = dataToDto(PlaceDto, plain) as PlaceDto;
        expect(Array.isArray(dto.nearby)).toBe(true);
        expect(dto.nearby).toHaveLength(2);
        for (const g of dto.nearby) expect(g).toBeInstanceOf(GeoDto);
        expect(dto.nearby[1].lat).toBe(5);
    });
});
