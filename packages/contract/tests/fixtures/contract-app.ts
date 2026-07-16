// A "real consumer" fixture: it defines DTOs via @injitools/contract and is built
// as a browser bundle. Field types are NOT duplicated explicitly — they are derived from the code via
// design:type (exactly the scenario the SWC/Babel metadata plugin is needed for).
import {
    Dto,
    DtoProperty,
    DtoLink,
    DtoLinkArray,
    generateZodValidation,
    dataToDto,
    ErrorResponseDto,
} from "@injitools/contract";

@Dto()
export class AddressDto {
    @DtoProperty() city: string;
    @DtoProperty() zip: string;
}

@Dto()
export class UserDto {
    @DtoProperty() name: string;
    @DtoProperty() age: number;
    @DtoProperty({optional: true}) nickname?: string;
    @DtoLink(AddressDto) address: AddressDto;
    @DtoLinkArray(AddressDto) prevAddresses: AddressDto[];
}

export {ErrorResponseDto, dataToDto, generateZodValidation};

// Used both by the unit test and (as the entry) by the Vite build test.
export function buildUserSchema() {
    return generateZodValidation(UserDto);
}
