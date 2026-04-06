const DEFAULT_PORT = 8787;

export function resolvePort(value: string | undefined): number {
  const parsedPort = Number(value);

  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}
