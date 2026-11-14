# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The signature has no background box: name, title, logo and buttons sit on
  the email's own background, and each button is its own link. The moving
  photo sits on a white tile with see-through corners; the background colour
  choice is gone.
- Comet, pulse (now "Ripple") and still redrawn: a tapering comet tail, eased
  ripples from a steady ring, and a still ring that blends the two colours.
- The page takes the look of Pile Sprint: League Spartan throughout, a hero,
  solid colour icons, pill buttons.
- Real sample photos (Unsplash, credited in the README) in place of drawings.

### Removed

- The card (photo with a line in a speech bubble) and its line field.

### Added

- Blur backdrop: your own background, softly out of focus, you sharp in front.
- `scripts/paste-proof.mjs`: pastes a copied signature into a message body
  and checks each button is its own link with no box behind it.

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
  up to three badges; brand colour and second colour; rich-text
  and HTML copy; steps for Gmail, Outlook and Apple Mail.
- `src/storage.js` and `src/config.js` for running it inside a portal:
  storage, prefilled details, locked brand.
- `server.mjs`: serves the page and keeps the pictures, with an optional team
  key, a size limit and an hourly limit. Dockerfile.
