import {z} from "zod";

import ResponseDto from "../decorators/ResponseDto.js";
import DtoProperty from "../decorators/DtoProperty.js";

@ResponseDto()
export default class ErrorResponseDto {
    @DtoProperty()
    error: string

    @DtoProperty()
    message: string

    // payload can be anything — make it unknown and optional
    @DtoProperty({validation: z.unknown()})
    payload: unknown

    // inherit — an array of strings
    @DtoProperty({validation: z.array(z.string())})
    inherit: string[]
}
