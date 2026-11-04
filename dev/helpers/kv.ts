import { Miniflare } from 'miniflare'

// A local Workers KV namespace, the same runtime and limits as on Cloudflare
export const miniflare = new Miniflare({
  kvNamespaces: ['KV'],
  modules: true,
  script: 'export default { fetch: () => new Response() }',
})

export const namespace = await miniflare.getKVNamespace('KV')
