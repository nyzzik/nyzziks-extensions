import {
    PaperbackInterceptor,
    Request,
    Response,
} from "@paperback/types";
import { AS_DOMAIN } from "./AsuraConfig";

export class AsuraInterceptor extends PaperbackInterceptor {

    override async interceptRequest(request: Request): Promise<Request> {
        // Impossible to have undefined headers, ensured by the app
        request.headers = {
            ...request.headers,
            referer: `${AS_DOMAIN}/`,
        };

        // Padding 60 secs to make sure it wont expire in-transit if the connection is really bad
        return request;
    }

    override async interceptResponse(
        request: Request,
        response: Response,
        data: ArrayBuffer,
    ): Promise<ArrayBuffer> {
        return data;
    }
}