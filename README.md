# @digitalwerber/payload-kv-cloudflare

A [Payload](https://payloadcms.com) KV adapter backed by [Cloudflare Workers KV](https://developers.cloudflare.com/kv/). Use it as `kv` in your Payload config, then read and write through `payload.kv`.

> Work in progress: not published to npm yet.

## Planned

- Pass a `KVNamespace` binding; the adapter knows nothing else about your project.
- Optional expiration per key prefix, for example `ttl: { "cache:": 30 * 24 * 3600 }`. The longest matching prefix wins; keys without a match never expire.
- Workers KV limits are handled by the adapter: keys over 512 bytes, the 60 second minimum expiration, and paginated `keys()` and `clear()`.

## Supported Payload versions

Payload 4 (beta).

## License

MIT
