# B.B.B.B 50 — RSVP microsite

A one-page RSVP site on True Black. Replies land in a Google Sheet. Each guest gets a confirmation email with a calendar invite.

## What's in here

- `index.html` — the page: party details, RSVP form, "Me +" counter, confirmation screen
- `memories.html` — "Twenty years of B.B.B.B": a year-by-year scroll of past bashes, linked from the RSVP page
- `assets/years/` — the memories photos, invites and the 2024 IVY clip, shrunk for phones (about 7MB)
- `assets/bbbb-mark.png` — the brush-script B.B.B.B FIFTY mark on True Black
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
- **Colours.** Crusta and Razzmatazz use standard values. Swap them for your v1.2 design-system values at the top of the CSS.
- **Spam.** A hidden field catches bots. Anything it catches is ignored.
