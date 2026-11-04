import type { Payload } from 'payload'

import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { CloudflareKVAdapter } from '../src/index.js'
import { miniflare, namespace } from './helpers/kv.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
  await miniflare.dispose()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

const expirations = async (prefix: string) =>
  Object.fromEntries(
    (await namespace.list({ prefix })).keys.map(({ name, expiration }) => [name, expiration]),
  )

describe('cloudflareKVAdapter', () => {
  test('payload.kv reads and writes Workers KV', async () => {
    await payload.kv.set('posts:1', { title: 'Hello' })

    expect(await payload.kv.get('posts:1')).toEqual({ title: 'Hello' })
    expect(await payload.kv.has('posts:1')).toBe(true)
    expect(await payload.kv.keys()).toEqual(['posts:1'])
    expect(await namespace.get('payload-kv:posts:1', 'json')).toEqual({ title: 'Hello' })

    await payload.kv.delete('posts:1')
    expect(await payload.kv.get('posts:1')).toBeNull()
    expect(await payload.kv.has('posts:1')).toBe(false)
  })

  test('expires keys by their longest matching prefix', async () => {
    const kv = new CloudflareKVAdapter({
      keyPrefix: 'ttl:',
      namespace,
      ttl: { 'cache:': 3600, 'cache:media:': 7200, 'short:': 10 },
    })
    const now = Date.now() / 1000

    await Promise.all(
      ['cache:posts', 'cache:media:1', 'short:1', 'users:1'].map((key) => kv.set(key, 1)),
    )
    const expiration = await expirations('ttl:')

    expect(expiration['ttl:cache:posts']).toBeCloseTo(now + 3600, -1)
    expect(expiration['ttl:cache:media:1']).toBeCloseTo(now + 7200, -1)
    expect(expiration['ttl:short:1']).toBeCloseTo(now + 60, -1)
    expect(expiration['ttl:users:1']).toBeUndefined()
  })

  test('stores keys over 512 bytes with their prefix and expiration', async () => {
    const kv = new CloudflareKVAdapter({ keyPrefix: 'long:', namespace, ttl: { 'cache:': 3600 } })
    const key = `cache:${'ü'.repeat(300)}`

    await kv.set(key, 'value')
    const [name, expiration] = Object.entries(await expirations('long:'))[0]

    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(512)
    expect(name.startsWith('long:cache:ü')).toBe(true)
    expect(expiration).toBeDefined()
    expect(await kv.get(key)).toBe('value')
    expect(await kv.has(key)).toBe(true)
    expect(await kv.keys()).toEqual([key])

    await kv.delete(key)
    expect(await kv.has(key)).toBe(false)
  })

  test('rejects keys too long for the metadata', async () => {
    const kv = new CloudflareKVAdapter({ keyPrefix: 'too-long:', namespace })

    await expect(kv.set('x'.repeat(1100), 1)).rejects.toThrow('Key too long')
  })

  test('rejects key prefixes that shortened keys could not keep', () => {
    expect(() => new CloudflareKVAdapter({ keyPrefix: 'x'.repeat(448), namespace })).toThrow(
      'keyPrefix too long',
    )
  })

  test('keys and clear page through more than one list page', async () => {
    const kv = new CloudflareKVAdapter({ keyPrefix: 'many:', namespace })
    const keys = Array.from({ length: 1500 }, (_, i) => `posts:${i}`)
    await namespace.put('other:1', '1')

    for (const key of keys) {
      await kv.set(key, 1)
    }
    expect((await kv.keys()).sort()).toEqual(keys.sort())

    await kv.clear()
    expect(await kv.keys()).toEqual([])
    expect(await namespace.get('other:1')).toBe('1')
  })
})
