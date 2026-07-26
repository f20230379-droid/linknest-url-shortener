# LinkNest

A full-stack URL shortener with custom aliases, persistent storage, redirects, and click analytics. It uses only Node.js built-in modules, so it runs with no package installation.

## Features

- Create short links from any valid HTTP(S) URL
- Choose a custom alias or generate one automatically
- Redirect visitors to the destination URL
- Track total clicks and the most recent visit for every link
- Copy a short URL from the dashboard
- Delete links you no longer need
- Persist data locally in `data/links.json` while developing
- Store production data in Supabase, with atomic click-count updates
- Deploy publicly to Render

## Run locally

```bash
cd url-shortener
npm run dev
```

Then open `http://localhost:3000`.

## Deploy

Follow the step-by-step instructions in [DEPLOYMENT.md](DEPLOYMENT.md). The public version stores links in Supabase instead of the local JSON file.

## Suggested next upgrades

- Add user accounts with secure password hashing
- Add QR codes, expiration dates, and custom domains
- Deploy to Render, Railway, or Fly.io
