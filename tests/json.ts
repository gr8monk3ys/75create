// ts-reset types JSON.parse as unknown; tests read back stored shapes they just wrote.
export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T
}

export type Outbox = { challenges: string[]; dayData: string[] }
export type Stamps = { challenges: Record<string, string>; dayData: Record<string, string> }
