# Security policy

## Reporting a problem

Please do **not** open a public issue for a security problem.

Report it privately through
[GitHub's private vulnerability reporting](../../security/advisories/new)
(the **Security** tab, then **Report a vulnerability**). Include what you
found, how to reproduce it, and what someone could do with it.

You should hear back within a week. Once a fix is released we will credit
you in the release notes, unless you would rather not be named.

## Supported versions

Only the latest release gets security fixes.

## What counts

Anything that breaks the promises in [PRIVACY.md](PRIVACY.md) or lets someone
misuse a server, for example:

- the original photo, or anything typed into the form, leaving the browser;
- script or unsafe links getting into a copied signature (a `javascript:`
  link, an event handler, an unescaped name);
- `server.mjs` serving any file other than the page's own files and saved
  pictures, storing anything that isn't a picture, or letting one picture
  overwrite another;
- getting around `UPLOAD_KEY`, the size limit or the hourly limit.
