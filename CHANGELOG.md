# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-11-14

### Added

- Your brand: logo and symbol upload; brand colours read off the logo;
  backdrops made from the brand's colours with its symbol tone on tone
  behind the photo.
- Photo studio: cut-out in the browser, head framing, 13 backdrops plus one
  from your brand colour, halo shapes, studio light and shadow, light, warmth
  and zoom touch-ups, photo download.
- Email signature: moving photo in four designs (orbit, comet, pulse, still)
  and three shapes; name, title, company or logo; buttons for booking,
  LinkedIn, email, website and phone; buttons for you, your team or both;
  up to three badges; brand colour, second colour and background; rich-text
  and HTML copy; steps for Gmail, Outlook and Apple Mail.
- Card: photo and your line with a highlighted word, as a picture.
- `src/storage.js` and `src/config.js` for running it inside a portal:
  storage, prefilled details, locked brand.
- `server.mjs`: serves the page and keeps the pictures, with an optional team
  key, a size limit and an hourly limit. Dockerfile.
