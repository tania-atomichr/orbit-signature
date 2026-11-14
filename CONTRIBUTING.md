# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Small fix?** Open a pull request straight away.
- **New feature or a bigger change?** Open an issue first so we can agree on
  the shape before you spend time on it.
- **Security problem?** Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Set up

No build step: plain JavaScript, HTML and CSS.

```sh
git clone https://github.com/<you>/orbit-signature.git
cd orbit-signature
node server.mjs          # http://localhost:8080
```

Edit a file and reload the page.

## Run the tests

```sh
npm install
npx playwright install chromium
npm test
```

The tests drive the real page in Chromium, with its server and as plain
files. Every pull request runs them on GitHub as well.

## What we look for in a pull request

- **One change per pull request**, with a short description of what it does
  and how you checked it. Add screenshots for anything you can see, at a desk
  (1280px) and on a phone (390px).
- **The tests pass**, and a new behaviour gets a check in `test/e2e.mjs` or
  `test/unit.mjs`.
- **It still works in an inbox.** The signature is tables, inline styles,
  Arial and PNG or GIF pictures at public addresses. No web fonts, SVG,
  `<style>` blocks or CSS that mail apps drop. Say which mail apps you pasted
  it into.
- **Privacy holds.** The original photo never leaves the browser. Pictures
  leave only through `src/storage.js`. No analytics, no requests to other
  sites, no new third-party files without a licence entry in
  `vendor/README.md`.
- **The server stays small.** No dependencies; it takes pictures only and
  serves only the page's own files.
- **Words on screen** are plain and in sentence case: "Copy signature", not
  "COPY SIGNATURE" or "Generate signature asset".

## Code style

- Modern JavaScript modules, no dependencies, no build step. Keep it that
  way so anyone can read and run the source as is.
- Two-space indent, double quotes, semicolons (see `.editorconfig`).
- Comments explain *why*, not *what*.

## Releases

1. Update `version` in `package.json`.
2. Add a section to [CHANGELOG.md](CHANGELOG.md).
3. Tag the commit `vX.Y.Z` and create a GitHub release.

By contributing you agree that your contribution is licensed under the
[MIT License](LICENSE), and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
