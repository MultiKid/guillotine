declare module "socket.io-client" {
  export interface Socket {
    connected: boolean;
    disconnect: () => void;
    emit: (eventName: string, payload?: unknown, callback?: (response: unknown) => void) => void;
    on: (eventName: string, callback: (...args: unknown[]) => void) => Socket;
    off: (eventName: string, callback?: (...args: unknown[]) => void) => Socket;
  }

  export function io(uri?: string, options?: Record<string, unknown>): Socket;
}
