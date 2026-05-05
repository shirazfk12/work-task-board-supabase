# Work Task Board with Supabase

A dark-mode work task board for GitHub Pages with a free Supabase backend.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `supabase-schema.sql`
- `README.md`

## Supabase setup

1. Go to Supabase and create a free project.
2. Open your project.
3. Go to **SQL Editor**.
4. Paste the contents of `supabase-schema.sql`.
5. Click **Run**.
6. Go to **Project Settings → API**.
7. Copy:
   - Project URL
   - anon public key
8. Open `config.js`.
9. Replace:

```js
window.SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
window.SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
```

with your real values.

## Deploy to GitHub Pages

Upload these files directly to the root of your repository:

```text
index.html
styles.css
app.js
config.js
supabase-schema.sql
README.md
```

Then go to:

**Settings → Pages → Deploy from a branch → main → / root → Save**

## Security note

This starter uses public read/write policies so it works without login.

That means anyone who finds your site can add/edit/delete tasks. For a personal hidden repo URL, that may be acceptable temporarily. For private work data, add Supabase Auth and user-based policies before storing sensitive information.
