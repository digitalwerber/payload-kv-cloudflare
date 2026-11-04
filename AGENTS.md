# @digitalwerber/payload-kv-cloudflare

A KV adapter for Payload (`kv` in the config, `payload.kv`) backed by Cloudflare Workers KV: pass a `KVNamespace` binding, optionally with expiration times per key prefix.

Built from `create-payload-app --template plugin`: the plugin lives in `src/`, `dev/` is a small Payload project for developing and testing it (`pnpm dev`, tests in `dev/*.spec.ts`).

## Public repo

Everything in this repo (code, comments, README, commit messages, branch names, issues, PRs, review replies, release notes) is in English. Examples, names and test data stay generic and describe what the plugin does for any Payload project; examples use generic Payload data (`posts`, `media`, `users`).

## Conventions

- Follow Payload's plugin guide (https://payloadcms.com/docs/v4/plugins/build-your-own.md, index at https://payloadcms.com/docs/v4/llms.txt): the plugin is `(options) => (config) => config`, spreads existing config, calls existing functions such as `onInit` before its own, and has a `disabled` option where that makes sense (keeping its schema when disabled).
- Options are typed with JSDoc and exported from `src/index.ts`.
- Use what Payload already provides before building your own.
- Supported Payload versions: `peerDependencies`, the CI matrix and the README list the same ones. The README names them without reasoning.
- SemVer. Every major version states its Payload compatibility in the README and release notes.
- Format with `pnpm exec oxfmt`, then `pnpm lint`, `pnpm build`, `pnpm test:int` before every push.
- The README is for users of the plugin: install, options, supported Payload versions and limits. No prices, quotas or other facts about third-party services that change without a release of this plugin; link to the provider's page if needed.

## Workflow

- No direct push to `main`: branch, `gh pr create`, CodeRabbit review, merge after green CI.
- Release: bump the version in a PR (`npm version <x.y.z> --no-git-tag-version`), merge, then `gh release create v<x.y.z> --generate-notes`; for a major version add `--notes "Supports Payload …"`, which goes before the generated notes. `release.yml` publishes to npm via Trusted Publishing with provenance.
