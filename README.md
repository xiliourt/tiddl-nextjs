# Instant Deploy - Try it Yourself!
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/xiliourt/tiddl-nextjs)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxiliourt%2Ftiddl-nextjs%2Ftree%2Fmain)

### Run locally
File system access functionality requires https in most browsers, as such either dev (with an auto generated self-signed certificate) or a reverse proxy is required.

**Option 1**

```npm run dev```

Connect via https://127.0.0.1:3000

**Option 2**

```npm run build && npm run start```

Place it behind a reverse proxy pointing to http://{ip}:3000, have the proxy add a certificate.

# Next.JS / React Tidal Downloader
A full client-side browser-based Tidal downloader, with easy authentication support, advanced configuration settings (such as path and naming schemes), multi threading, and a simplistic UI for a user friendly experience.

### Features
- Easy authentication via generated login authentication link at first load (stored client-side only)
- Supports track, album, artist and playlist links
- Supports selecting a download directory to download files direct to disk
- In depth config, allowing customisation of even download directory structure and file naming 
- Automatic token refreshing upon reload (also refreshable via the 'refresh token' button)
- Purely client side - no API callbacks / server-side processing. Uses client-side axios calls.
- Typescript for maintainability and reusability (_My first real attempt at ts/tsx - I'll clean it up to be true typescript over time_)

### Missing Features (to be added)
- Video downloading support
- Refresh token upon expired token error
- Extra error handling
  - Catch unexpected Tidal API responses and deal with non 200 status codes
- Add interfaces / models / types for easier maintainability 
- Clean up code (some typing is incorrect, need to spend some extra time on it to improve maintainability)

### Outside of Scope
- Remote downloading _(ie server side downloads, rather than client side local downloading)_
- Displaying Tidal data _(album covers, artist info, etc)_
- Any Tidal client-like features _(ie viewing your playlists, browsing, etc)_
- Search functionality _(good idea, but outside of scope for now)_


## For personal use only. Support your favourite artists - buy their albums, see their shows!
_Created as a hobby project / for educational purposes. For personal use only._
