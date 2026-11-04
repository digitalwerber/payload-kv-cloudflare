import type { KVAdapter, KVAdapterResult, KVStoreValue } from 'payload'

/**
 * The parts of a Workers KV binding (`KVNamespace`) the adapter uses. A binding from
 * `env` fits as is.
 */
export type KVNamespaceLike = {
  delete(key: string): Promise<void>
  get(key: string, type: 'json'): Promise<unknown>
  list(options: { cursor?: string; prefix?: string }): Promise<{
    cursor?: string
    keys: { metadata?: unknown; name: string }[]
    list_complete: boolean
  }>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; metadata?: unknown },
  ): Promise<void>
}

export type CloudflareKVAdapterOptions = {
  /**
   * Prefix for the stored keys, to share a namespace with other data
   *
   * @default 'payload-kv:'
   */
  keyPrefix?: string
  /** The Workers KV binding, for example `env.KV` */
  namespace: KVNamespaceLike
  /**
   * Expiration in seconds per key prefix, for example `{ 'cache:': 30 * 24 * 3600 }`. The
   * longest matching prefix wins, keys without a match never expire. Values under 60 are
   * raised to 60, the minimum of Workers KV.
   */
  ttl?: Record<string, number>
}

// Workers KV limits
const MAX_KEY_BYTES = 512
// '#' and a SHA-256 in hex, the end of shortened keys
const HASH_SUFFIX_BYTES = 65
const MAX_METADATA_BYTES = 1024
const MIN_TTL = 60

const encoder = new TextEncoder()
const byteLength = (value: string) => encoder.encode(value).length

const sha256 = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

export class CloudflareKVAdapter implements KVAdapter {
  private readonly ttl: [string, number][]
  readonly keyPrefix: string
  readonly namespace: KVNamespaceLike

  constructor({ keyPrefix = 'payload-kv:', namespace, ttl = {} }: CloudflareKVAdapterOptions) {
    if (byteLength(keyPrefix) > MAX_KEY_BYTES - HASH_SUFFIX_BYTES) {
      // Shortened keys would lose part of the prefix, so keys() and clear() could not find them
      throw new Error(
        `keyPrefix too long for Workers KV: at most ${MAX_KEY_BYTES - HASH_SUFFIX_BYTES} bytes`,
      )
    }
    this.keyPrefix = keyPrefix
    this.namespace = namespace
    this.ttl = Object.entries(ttl).sort(([a], [b]) => b.length - a.length)
  }

  private async list(
    onPage: (names: { metadata?: unknown; name: string }[]) => Promise<void> | void,
  ): Promise<void> {
    let cursor: string | undefined
    do {
      const page = await this.namespace.list({ cursor, prefix: this.keyPrefix })
      await onPage(page.keys)
      cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
  }

  /**
   * The stored key. Keys over the Workers KV limit keep their start, so listing by prefix still
   * works, and end in a hash of the full key, which `set` keeps in the metadata for `keys()`.
   */
  private async name(key: string): Promise<string> {
    const name = this.keyPrefix + key
    if (byteLength(name) <= MAX_KEY_BYTES) {
      return name
    }
    const suffix = `#${await sha256(name)}`
    let head = ''
    let bytes = 0
    for (const char of name) {
      bytes += byteLength(char)
      if (bytes > MAX_KEY_BYTES - HASH_SUFFIX_BYTES) {
        break
      }
      head += char
    }
    return head + suffix
  }

  async clear(): Promise<void> {
    // shortcut: one delete per key, so a Worker may hit its per-request operation limit on big stores
    await this.list(async (names) => {
      for (const { name } of names) {
        await this.namespace.delete(name)
      }
    })
  }

  async delete(key: string): Promise<void> {
    await this.namespace.delete(await this.name(key))
  }

  async get<T extends KVStoreValue>(key: string): Promise<null | T> {
    return (await this.namespace.get(await this.name(key), 'json')) as null | T
  }

  async has(key: string): Promise<boolean> {
    return (await this.namespace.get(await this.name(key), 'json')) !== null
  }

  async keys(): Promise<string[]> {
    const keys: string[] = []
    await this.list((names) => {
      for (const { name, metadata } of names) {
        keys.push(
          (metadata as { key?: string } | undefined)?.key ?? name.slice(this.keyPrefix.length),
        )
      }
    })
    return keys
  }

  async set(key: string, data: KVStoreValue): Promise<void> {
    const name = await this.name(key)
    const metadata = name === this.keyPrefix + key ? undefined : { key }
    if (metadata && byteLength(JSON.stringify(metadata)) > MAX_METADATA_BYTES) {
      throw new Error(
        `Key too long for Workers KV (${byteLength(key)} bytes): ${key.slice(0, 64)}…`,
      )
    }
    const seconds = this.ttl.find(([prefix]) => key.startsWith(prefix))?.[1]
    await this.namespace.put(name, JSON.stringify(data), {
      expirationTtl: seconds === undefined ? undefined : Math.max(MIN_TTL, seconds),
      metadata,
    })
  }
}

/** Workers KV as Payload's KV store: `kv: cloudflareKVAdapter({ namespace: env.KV })` */
export const cloudflareKVAdapter = (options: CloudflareKVAdapterOptions): KVAdapterResult => ({
  init: () => new CloudflareKVAdapter(options),
})
