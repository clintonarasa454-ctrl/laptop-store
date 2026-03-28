# Contributing

Thanks for wanting to contribute! Quick guide to get changes accepted.

## Development workflow

- Create a feature branch from `main` with a descriptive name (e.g. `feature/add-checkout`).
- Keep commits small and focused.
- Run formatting and typecheck locally before pushing.

## Local checks

```bash
pnpm install
pnpm run format
pnpm run check
pnpm test
```

## Adding database changes

- Create Drizzle migrations under `drizzle/migrations/`.
- Test migrations locally against a disposable DB.
- Update `seed.mjs` if new required data should be seeded.

## Tests and CI

- Add unit tests with `vitest` for new logic.
- Ensure tests are deterministic and fast.

## PR description

- Provide a short summary of the change.
- Link relevant issues and design notes.
- Describe manual testing steps.

## Code style

- Follow existing TypeScript style and naming conventions.
- Use `prettier` for formatting.
- Keep lines and functions readable; prefer clarity over cleverness.

## Who to contact

- Open an issue or ping the repository owner for design questions.
