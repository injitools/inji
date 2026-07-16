import {Request, Response, NextFunction} from "express";
import {RequestError} from "../errors/RequestError.js";

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof RequestError) {
        res.status(err.code).json({
            error: err.type,
            message: err.message,
            payload: err.payload,
            inherit: err.inherit
        });
        return;
    }

    console.error(err);
    res.status(500).json({
        error: "InternalServerError",
        message: "Internal Server Error"
    });
};
