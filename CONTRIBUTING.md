# Contributing to Zenith

## Code Style

This project follows [Google's JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
for naming, spacing, and comment conventions. Key points:

- **Inline comments** — describe *why* or *intent*, not *what* the code does.
  Keep them short (1–3 lines) and place them immediately above the relevant block.
- **JSDoc** — required for all exported functions and non-trivial helpers.
  Include `@param`, `@returns`, and a plain-English description.
- **Avoid** comments that only restate the code or describe file movement history
  (use Git commit messages for provenance instead).

## Comment Examples

```js
// Good — explains why, not what
// Project position forward to factor in flick momentum before snapping.
const projected = baseY + dy + vel * MOMENTUM_PROJECTION_MS;

// Bad — restates the code
// Add dy to baseY and multiply vel by MOMENTUM_PROJECTION_MS.
```

## Running Tests

```
npm test
```
