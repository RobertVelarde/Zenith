# Source Layout (ARCH-10)

This codebase is organized by feature domain.

## Top-level folders
- `app/`: app composition, providers, global state context
- `features/`: user-facing feature modules (panel, map, solar, lunar, datetime, search)
- `shared/`: reusable UI components, hooks, and utilities shared across features
- `config/`: constants and configuration used across the app

## Import conventions
- Prefer local relative imports within a feature.
- Use shared modules from `src/shared/*` when reused by multiple features.
- Vite aliases are available:
  - `@features` -> `src/features`
  - `@shared` -> `src/shared`
  - `@config` -> `src/config`

## Feature boundaries
- Keep feature-specific logic inside its feature folder.
- Move only truly cross-feature code into `shared/`.
- Avoid importing from another feature unless there is a clear UI composition need.

## Migration note
Legacy `src/components`, `src/hooks`, and `src/utils` folders were replaced by feature and shared domains in ARCH-10.
