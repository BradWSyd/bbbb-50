# B.B.B.B 50 — RSVP microsite

A one-page RSVP site on True Black. Replies land in a Google Sheet. Each guest gets a confirmation email with a calendar invite.

## What's in here

- `index.html` — the page: party details, RSVP form, "Me +" counter, confirmation screen
- `memories.html` — "Twenty years of birthday memories": one photo and video wall of past bashes (no years, no venues), paint-on finale. Built by `make_memories.py` from `memories.template.html`
- `assets/years/` — the memories photos, invites and video clips (`<year>-v<n>.mp4` + `.jpg` poster), shrunk for phones
- `assets/bbbb50-shimmer.mp4`, `bbbb50-sweep-sq.mp4`, `bbbb50-still.jpg`, `bbbb50-sweep-end.jpg` — v3 colour-sweep logo: hero loop, paint-on, and their stills
- `assets/bbbb-mark.png` — the brush-script B.B.B.B FIFTY mark on True Black
- `assets/bbbb50-share-v2.jpg` — the 1200×630 link preview for WhatsApp, iMessage and social. `favicon-32.png` and `apple-touch-icon.png` are the tab and home-screen icons
- `apps-script/Code.gs` — the backend that logs rows and sends emails

## Set up (about 20 minutes)

1. **Make the Sheet.** In Google Drive, create a Sheet called `BBBB50 RSVPs`. Put it in the BBBB_50 folder.
2. **Add the script.** In the Sheet, open Extensions > Apps Script. Delete the starter code. Paste in `Code.gs`. Save.
3. **Optional ping.** To get an email for every RSVP, put your address in `NOTIFY_EMAIL`.
4. **Run setup.** Choose `setup` from the function menu and press Run. Approve the permissions. Your Sheet now has an `RSVPs` tab with headers.
5. **Deploy.** Deploy > New deployment > Web app. Execute as: **Me**. Who has access: **Anyone**. Deploy, then copy the URL ending in `/exec`.
6. **Connect the page.** In `index.html`, paste that URL into `RSVP_ENDPOINT` near the bottom.
7. **Publish.** Commit the files to the `bbbb-50` repo. Turn on GitHub Pages (Settings > Pages > deploy from the main branch).
8. **Test.** RSVP as yourself, once as Yes with a plus-two and once as No. Check the Sheet, the email and the calendar file.

## Good to know

- **Editing the script later?** Use Deploy > Manage deployments > Edit > New version. The URL stays the same.
- **Preview mode.** Until `RSVP_ENDPOINT` is set, the form runs as a demo and saves nothing.
- **Headcount.** For your live number, add this in a spare cell: `=SUM(FILTER(RSVPs!G:G, RSVPs!E:E="Yes"))`. Swap `"Yes"` for `"Maybe"` to see the maybes.
- **Email limit.** A personal Google account can send about 100 emails a day from Apps Script. That's plenty for this list.
- **Search engines.** The page tells Google not to index it, because it shows the address and guest details. A public mood board page, if you build one, should be a separate page.
- **Colours.** Crusta means "do this" (main buttons). Turquoise means "you chose this" (selected chips, focus). Razzmatazz means "fix this" (errors only). Values sit at the top of the CSS.
- **Spam.** A hidden field catches bots. Anything it catches is ignored.

## Memories wall: how to change it

1. Open `make_memories.py`. Edit `REMOVE` (codes to hide), `WIDE` (invite graphics shown full width), `VIDEOS` (clips) or `YOUTUBE` (videos that play in the page from YouTube).
2. New photo? Add `assets/years/<year>-<nn>.webp` (1400px max) and `assets/years/thumbs/<year>-<nn>.webp` (640px max). Files sort by name, so the code sets its place.
3. Run `python3 make_memories.py .` from the repo folder. It rewrites `memories.html`.
