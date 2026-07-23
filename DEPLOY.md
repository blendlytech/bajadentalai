# Deployment Instructions for Baja Dental AI

This document details how to correctly deploy your updates to the live website (`www.bajadentalai.com`) using Cloudflare Pages.

## 1. The Correct Website Directory

Your live website source code, including all the new pricing tiers, HTML files, CSS, and JS, is located in the `bajadental_site` directory.

> [!WARNING]
> **Do not deploy the `dist` directory.** The `dist` directory contains an older, alternate version (or an offline demo script). If you accidentally deploy `dist`, the website will revert to the old version.

## 2. The Deployment Command

To deploy your latest code, run the following command from the root of your project (`ai mexico`):

```powershell
npx wrangler pages deploy bajadental_site --project-name=baja-dental-ai --branch=main
```

### Breakdown of the Command

- `bajadental_site`: This tells Wrangler to upload the files from your actual website folder.
- `--project-name=baja-dental-ai`: Points to your specific Cloudflare Pages project.
- `--branch=main`: Tells Cloudflare that this should be pushed directly to your main production branch (making it live on your custom domain).

## 3. Post-Deployment

After the command finishes, Wrangler will output a message similar to this:

```text
✨ Deployment complete! Take a peek over at https://<id>.baja-dental-ai.pages.dev
```

Your custom domain (`www.bajadentalai.com`) will automatically update to reflect the new changes within seconds.

> [!TIP]
> If you visit your website and still see the old version, try doing a **hard refresh** (Ctrl + Shift + R on Windows) to clear your browser's cache.
