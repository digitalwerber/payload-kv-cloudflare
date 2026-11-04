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

### Handled by the adapter

- **Keys over 512 bytes** are stored under a shortened key: its start, including the prefix, followed by a hash of the full key. `ttl` still applies and `keys()` returns the full key. Keys of about 1000 bytes and more are rejected, because the full key has to fit into the 1024 bytes of KV metadata.
- **Expiration** is at least 60 seconds.
- **`keys()` and `clear()`** page through the whole list.

### Not handled by the adapter

For the current numbers, see [Cloudflare's KV limits](https://developers.cloudflare.com/kv/platform/limits/).

- **Eventual consistency.** A write reaches other locations with a delay. Don't use the store for values several requests must agree on at once, such as counters or locks.
- **Writes to the same key** are rate limited; more frequent writes may fail.
- **KV operations per Worker invocation** are limited. `clear()` deletes key by key, so on a larger store it can fail part way; call it again in a new invocation until `keys()` is empty.
- **Values** are stored as JSON and count against the KV value size limit.

## License

MIT
