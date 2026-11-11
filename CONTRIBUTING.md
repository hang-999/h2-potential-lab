# Contributing / 参与开发

This is a browser-local teaching laboratory for machine-learning interatomic potentials. The production laboratory is an offline HTML file; the reading library has separate assets and runtime requirements.

## Development

Use Node.js 24. Run `npm ci`, `npm test`, `npm run build`, then `npm run serve`. Open the address printed by the preview server. No runtime CDN or cloud training is required for laboratory chapters.

## Changes and tests

- Edit source files, not generated `index.html` files. Rebuild and commit the generated output with the source change.
- Numerical changes need independent references or finite-difference tests, explicit units, and symmetry checks where applicable. Distinguish full scientific architectures from teaching models.
- Training updates must preserve prepare/commit/cancel transactions, fixed-seed reproducibility, train-only normalization, and validation isolation.
- UI changes must preserve selection, model Step consistency, keyboard access, light/dark contrast, SVG fallback, and narrow-screen layout.
- Run `npm run test:quick` during development and the complete `npm test` before publication. `npm run test:forces` checks H₂ force inference, mixed gradients, and convergence.
- Check built files opened directly without networking. The reading library remains a separate distribution with the requirements documented in its README.

## Pull requests

Describe the observed problem, changed behavior, and validation. Include screenshots for layout changes and measured errors for numerical changes. Keep new dependencies and large assets justified. Do not include local paths, credentials, third-party model weights, or licensed review PDFs.

## Architecture

UI and SVG/Three.js views read immutable numerical snapshots. Independent Workers run method operators, multi-atom training, and H₂ training. H₂ energy-force conventions are documented in [ENERGY_FORCE.md](ENERGY_FORCE.md). The [API](API.md), [scene conventions](SCENE.md), and [numerical references](NUMERICS.md) provide implementation details.
