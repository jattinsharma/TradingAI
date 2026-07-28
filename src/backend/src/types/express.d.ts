/**
 * Custom type declaration for express.
 * Used when @types/express is not available (production build on Render).
 * @types/express stays in devDependencies for full type-checking during development.
 */
declare module 'express' {
  import { IncomingMessage, ServerResponse } from 'http';

  interface Request extends IncomingMessage {
    body?: any;
    query: Record<string, string>;
    params: Record<string, string>;
    headers: Record<string, string | string[] | undefined>;
    user?: any;
  }

  interface Response extends ServerResponse {
    status(code: number): this;
    json(body?: any): this;
    send(body?: any): this;
  }

  type NextFunction = (err?: any) => void;

  export function json(options?: { limit?: string | number }): (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  export { Request, Response, NextFunction };
}
