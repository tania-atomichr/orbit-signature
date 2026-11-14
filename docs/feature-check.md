# The portal it came from vs Orbit signature

Orbit signature started as the Profile page of an in-house recruiting portal. Every part of that page that makes the photo and the signature was read and carried over: the photo studio, the form and preview, the moving picture, and how the signature is copied and pasted.

## Included

| In the portal | In Orbit signature |
|---|---|
| Upload a photo, the background is taken away in the browser | Same model (u2netp), run in the browser, nothing sent anywhere |
| Stray blobs dropped, edge softened | Same clean-up steps |
| Every face framed the same way (head height and centre) | Same framing numbers |
| 13 studio backdrops plus "Your colour" | Same 13, plus five made from your brand colours |
| Glow, halo, soft key light, corner fall-off, floor, shadow | Same paint recipe |
| Halo shapes | Circle, asterisk, star, none, plus your logo softly behind you |
| Light, warmth and zoom sliders | Same |
| "Original" tile to keep the photo as it was | Same, plus **Blur**: your own background softly out of focus |
| Our orbit moving picture | Orbit, comet, pulse or still, in a circle, rounded square or square |
| The company's own colours | Your accent, second and background colours, picked from your logo |
| The company's own logo | Your logo and symbol |
| Name, title, badges | Same |
| Contact buttons: email, booking link, phone, website, LinkedIn | Same five |
| Buttons for me, for the team inbox, or both | Same, your name still signs |
| Signature as text and pictures on the email's background, each button its own link | Same, checked by pasting into a message (`scripts/paste-proof.mjs`) |
| Moving photo on a white tile with see-through corners | Same; the tile colour can change |
| Copy signature, paste into Gmail | Copy signature or copy HTML; steps for Gmail, Outlook and Apple Mail |
| Pictures saved for you, so the paste just works | `server.mjs` saves them, or your portal does through `src/storage.js` |
| Your details filled in from your account | `window.ORBIT_SIGNATURE` fills in person, team and brand |
| Company look kept the same for everyone | `locked` fields |
| Remembers your last signature | Same, in your browser |
| Phone layout | Same, checked at 390 |

## Left out on purpose (tied to our systems)

- LinkedIn banners: a separate project later.
- Live portal badges: here they are plain pictures you add by address.
- The card (photo with a line in a speech bubble): not needed for a signature.
- Login and the links to other in-house tools: your portal brings its own login and passes details in through the config.
