# Privacy

Orbit signature has no accounts, no analytics and no tracking. This page says
exactly what it keeps and where it can go, so it can also serve as the
privacy note for a copy you run for your team.

## On your device

- **Your photo** is read, cut out and painted on a backdrop by the page, in
  your browser. The model that finds you in the photo runs on your device.
- **The form** (name, title, line, links, colours, choices) and **the cut-out
  photo** are kept in your browser's local storage, so a reload keeps your
  work. Clear the site's data in your browser to forget them.

## What leaves your browser

Only when the page has somewhere to keep pictures (its server, or your
portal's storage in `src/storage.js`):

- **the finished moving photo** (the GIF in your signature), and
- **your logo**, if you upload one.

They are sent so that the people you email can load them; that is how email
signatures work. Your original photo, the cut-out, and everything typed into
the form are never sent.

Downloads (the photo, the card, the moving photo) are made in the browser
and saved straight to your device.

## On the server

`server.mjs` keeps the pictures it is sent in `DATA_DIR`, named by their
content, until whoever runs it deletes them. Anyone with a picture's address
can load it, as with any picture in an email. It keeps no names, emails or
form data, and no logs of who sent what beyond the in-memory hourly limit.

## Other sites

The page loads nothing from other sites: its fonts, the model and the model's
runtime are files in this repository. A copied signature points only at the
addresses you give it (your links, your badges) and at the pictures' storage.
