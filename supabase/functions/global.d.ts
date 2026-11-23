// Ambient type definitions for Supabase Edge Functions (Deno runtime)
// Resolves Deno globals and https:// URL imports in VS Code TypeScript server

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
  export function serve(
    options: { port?: number; hostname?: string; onListen?: (params: { port: number; hostname: string }) => void },
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}

declare module 'https://*' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any;
  export default content;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const createClient: any;
}
