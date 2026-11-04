# @digitalwerber/payload-kv-cloudflare

A [Payload](https://payloadcms.com) KV adapter backed by [Cloudflare Workers KV](https://developers.cloudflare.com/kv/). Use it as `kv` in your Payload config, then read and write through `payload.kv`.

## Install

```sh
pnpm add @digitalwerber/payload-kv-cloudflare
```

## Usage

Pass the KV namespace binding of your Worker:

```ts
import { cloudflareKVAdapter } from '@digitalwerber/payload-kv-cloudflare'
import { buildConfig } from 'payload'

export default buildConfig({
  // ...
  kv: cloudflareKVAdapter({
    namespace: env.KV,
    ttl: { 'cache:': 30 * 24 * 3600 },
  }),
})
```

```ts
await payload.kv.set('cache:posts', posts) // expires after 30 days
await payload.kv.get('cache:posts')
```

## Options

| Option      | Default         | Description                                                                                                                                  |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `namespace` | required        | The Workers KV binding (`KVNamespace`).                                                                                                      |
| `ttl`       | `{}`            | Expiration in seconds per key prefix. The longest matching prefix wins; keys without a match never expire. Values under 60 are raised to 60. |
| `keyPrefix` | `'payload-kv:'` | Prefix for the stored keys. `keys()` and `clear()` only see keys with this prefix, so the namespace can hold other data.                     |

## Supported Payload versions

Payload 3.62 and later, Payload 4 (beta).

## Limits

The adapter handles these Workers KV limits for you:

- **Keys over 512 bytes** are stored under a shortened key: its start, including the prefix, followed by a hash of the full key. `ttl` still applies and `keys()` returns the full key. Keys of about 1000 bytes and more are rejected, because the full key has to fit into the 1024 bytes of KV metadata.
- **Expiration** is at least 60 seconds.
- **`keys()` and `clear()`** page through the whole list, 1000 keys per page.

What stays with you:

- **Eventual consistency.** A write is visible right away in the location that made it, elsewhere usually within 60 seconds. Don't use the store for values several requests must agree on at once, such as counters or locks.
- **One write per second to the same key.** More frequent writes to a key may fail.
- **Operations per Worker invocation** are limited to 1000. `clear()` deletes key by key, so on a larger store it fails part way; call it again in a new invocation until `keys()` is empty.
- **Values** are stored as JSON, up to 25 MiB each.

## Costs

Every call is a Workers KV operation, billed by [Cloudflare's KV pricing](https://developers.cloudflare.com/kv/platform/pricing/):

| Call             | KV operations                               |
| ---------------- | ------------------------------------------- |
| `get()`, `has()` | 1 read                                      |
| `set()`          | 1 write                                     |
| `delete()`       | 1 delete                                    |
| `keys()`         | 1 list per 1000 keys                        |
| `clear()`        | 1 list per 1000 keys, plus 1 delete per key |

The free plan includes 100,000 reads and 1,000 writes, deletes and lists per day; writes are what runs out first. The paid plan includes 10 million reads and 1 million each of writes, deletes and lists per month, then $0.50 per million reads and $5 per million of the others. Storage beyond 1 GB costs $0.50 per GB-month.

## License

MIT
