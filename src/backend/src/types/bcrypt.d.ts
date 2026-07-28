/**
 * Custom type declaration for bcrypt.
 * Used when @types/bcrypt is not available (production build on Render).
 * @types/bcrypt stays in devDependencies for full type-checking during development.
 */
declare module 'bcrypt' {
  /**
   * Generate a salt with the specified number of rounds.
   */
  export function genSalt(rounds: number): Promise<string>;

  /**
   * Hash data using the provided salt.
   */
  export function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;

  /**
   * Compare data against a hashed value.
   */
  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
}
