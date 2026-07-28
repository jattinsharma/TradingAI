/**
 * Custom type declaration for passport-jwt.
 * Used when @types/passport-jwt is not available (production build on Render).
 * @types/passport-jwt stays in devDependencies for full type-checking during development.
 */
declare module 'passport-jwt' {
  import { Request } from 'express';

  interface StrategyOptions {
    jwtFromRequest?: (req: Request) => string | null;
    secretOrKey?: string | Buffer;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
    ignoreExpiration?: boolean;
    passReqToCallback?: boolean;
    jsonWebTokenOptions?: Record<string, unknown>;
  }

  type VerifyCallback = (error: any, user?: any | false) => void;

  type VerifyFunction = (payload: Record<string, unknown>, done: VerifyCallback) => void;

  class Strategy {
    constructor(options: StrategyOptions, verify?: VerifyFunction);
    name: string;
    authenticate(req: Request, options?: unknown): void;
  }

  const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
    fromHeader(headerName: string): (req: Request) => string | null;
    fromBodyField(fieldName: string): (req: Request) => string | null;
    fromUrlQueryParameter(paramName: string): (req: Request) => string | null;
    fromAuthHeaderWithScheme(authScheme: string): (req: Request) => string | null;
  };

  export { Strategy, StrategyOptions, ExtractJwt, VerifyCallback, VerifyFunction };
}
