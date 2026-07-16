import {ResponseDto, DtoProperty} from "@injitools/core";

// Simple message response for operations without a payload (logout, delete).
// A pure RESPONSE DTO — no table behind it, so the field is declared directly.
@ResponseDto()
export class MessageDto {
    @DtoProperty()
    message: string;
}
