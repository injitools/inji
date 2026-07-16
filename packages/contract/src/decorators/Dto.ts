import RequestDto from "./RequestDto.js";

/**
 * @deprecated Use `@RequestDto()` / `@ResponseDto()` instead — a DTO's direction is now
 * a first-class distinction. Kept as an alias for `@RequestDto()` (the historical default
 * semantics were input-oriented).
 */
export default function Dto(): ClassDecorator {
    return RequestDto();
}
