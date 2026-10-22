# Todo

A small Next.js (App Router, TypeScript) todo list. Tasks are saved in the browser's localStorage, so no database or environment variables are needed.

Features: add, complete, edit (double-click or Edit button), delete, filter (All / Active / Done), clear completed, progress bar, light and dark themes.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com/new, import the repository, and click Deploy.
   Vercel detects Next.js automatically; no settings need changing.

Or with the CLI:

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```
