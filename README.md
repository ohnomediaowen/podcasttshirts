# PodcastTShirts.com

Static shop in `public/` (shows and shirts are defined in `public/index.html`) with an in-page editor.

- Edit the live shop: visit `/?edit`, enter the password (Netlify env var `EDIT_PASSWORD`), open a show's tab, click **Edit this page**.
- Edits are stored in Netlify Blobs (`site-content`, `site-images`) and applied on page load by `public/shop-edit.js`.
- Functions: `netlify/functions/` (content, image, admin).
