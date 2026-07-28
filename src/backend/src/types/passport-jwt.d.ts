/**
 * Custom type declaration for passport-jwt.
 * Used when @types/passport-jwt is not available (production build on Render).
 * @types/passport-jwt stays in devDependencies for full type-checking during development.
 */
declare module 'passport-jwt' {
  interface StrategyOptions {
    jwtFromRequest?: (req: any) => string | null;
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
    authenticate(req: any, options?: unknown): void;
  }

  const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): (req: any) => string | null;
    fromHeader(headerName: string): (req: any) => string | null;
    fromBodyField(fieldName: string): (req: any) => string | null;
    fromUrlQueryParameter(paramName: string): (req: any) => string | null;
    fromAuthHeaderWithScheme(authScheme: string): (req: any) => string | null;
  };

  export { Strategy, StrategyOptions, ExtractJwt, VerifyCallback, VerifyFunction };
}
