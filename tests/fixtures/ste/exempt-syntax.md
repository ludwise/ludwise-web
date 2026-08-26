# Machine syntax fixture

Run `pnpm run check:ste` and read `docs/language/policy.json` for detail.

```ts
const doesNotApply = "isn't prose, and the behaviour here is a catalogue";
```

Open <https://example.com/a/b> or read [the profile](docs/language/profile.md).

The `MAX_WORDS` constant, the `StoreOffer` type and the `loadPolicy` function
stay exact. Set `LUDWISE_ENVIRONMENT` before you start.

<!-- doesn't count, because an HTML comment is not prose -->
