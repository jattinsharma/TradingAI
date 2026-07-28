/**
 * Custom type declaration for passport-local.
 * Used when @types/passport-local is not available (production build on Render).
 * @types/passport-local stays in devDependencies for full type-checking during development.
 */
declare module 'passport-local' {
  interface IStrategyOptions {
    usernameField?: string;
    passwordField?: string;
    session?: boolean;
    passReqToCallback?: boolean;
  }

  interface IVerifyOptions {
    message: string;
  }

  type VerifyFunction = (
    username: string,
    password: string,
    done: (error: any, user?: any | false, options?: IVerifyOptions) => void,
  ) => void;

  class Strategy {
    constructor(options: IStrategyOptions, verify?: VerifyFunction);
    name: string;
    authenticate(req: any, options?: unknown): void;
  }

  export { Strategy, IStrategyOptions, IVerifyOptions, VerifyFunction };
}
