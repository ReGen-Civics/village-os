# Live entrance in WebKit as an iPhone 13 (26 Nov 2026, 1.3.77)

The page was loaded signed out at https://amora.regencivics.earth/ and was read-only: every non-GET request to the village was aborted, and no form was sent.

- `1-at-rest.webp`: the welcome over the hero video. The video plays (muted, inline, past 3 s, no error). The **"Come in" button sits under the tab bar**: the button spans y 580 to 624 of a 664 px viewport, and the bar starts at y 599. A tap on the button's centre lands on the bar.
- `2-come-in-scrolled-to.webp`: the button scrolled into view.
- `3-after-come-in.webp`: "Come in" focuses the name field (`name`, autocomplete `name`, label "Name or Nickname"), but **the field scrolls up under the sticky logo header**, so the field taking focus cannot be seen.

No Turnstile iframe had rendered after "Come in". The console errors all come from Cloudflare's challenge script on a headless browser (a cross-origin frame, CORS 502 on challenges.cloudflare.com, and the CSP `data:` connect). They are not evidence about the app.
