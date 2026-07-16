// A "real consumer" fixture for the fetch client: controllers + DTOs used by the client
// unit/integration/type tests. The server-side InjiRouter reads the SAME registrations from the
// shared RoutesStorage singleton, so createApiClient (inter-server) mirrors the controller signature.
import {
    Router,
    Get,
    Post,
    Body,
    Query,
    Path,
    Response,
    RequestDto,
    ResponseDto,
    DtoProperty,
} from "@injitools/core";

@RequestDto()
export class EchoDto {
    @DtoProperty() text: string;
    @DtoProperty() times: number;
}

@ResponseDto()
export class EchoResultDto {
    @DtoProperty() text: string;
    @DtoProperty() repeated: string;
}

@RequestDto()
export class SearchQueryDto {
    @DtoProperty() term: string;
    @DtoProperty({optional: true}) limit?: number;
}

@Router("echo")
export class EchoApi {
    // POST /echo — body via @Body.
    @Post()
    @Response(200, EchoResultDto)
    create(@Body() body: EchoDto): EchoResultDto {
        return {text: body.text, repeated: body.text.repeat(body.times)};
    }

    // GET /echo/item/:id — path variable (@Path) + query object (@Query).
    @Get("item/:id")
    @Response(200, EchoResultDto)
    find(@Path("id") id: string, @Query() q: SearchQueryDto): EchoResultDto {
        return {text: id, repeated: `${q.term}:${q.limit ?? 0}`};
    }

    // GET /echo/ping — no arguments; primitive (text/plain) response.
    @Get("ping")
    @Response(200, String)
    ping(): string {
        return "pong";
    }
}
