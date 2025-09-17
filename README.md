# Next.JS / React Tidal Downloader
A full client-side browser-based Tidal downloader, with easy authentication support, advanced configuration settings (such as path and naming schemes), multi threading, and a simplistic UI for a user friendly experience.

### Features
- Easy authentication via generated login authentication link at first load (stored client-side only)
- Supports track, album, artist and playlist links
- Supports selecting a download directory to download files direct to disk
- In depth config, allowing customisation of even download directory structure and file naming 
- Automatic token refreshing upon reload (also refreshable via the 'refresh token' button)
- Purely client side - no API callbacks / server-side processing. Uses client-side axios calls.

### Missing Features (to be added)
- Video downloading support
- Refresh token upon expired token error
- Extra error handling
  - Catch unexpected Tidal API responses and deal with non 200 status codes
- Add interfaces / models / types for easier maintainability 
- Clean up code (ie Progress.tsx has a lot of repeated code, it could be one function that handles things based on 'type' ('track', 'album', 'artist', etc)

### Outside of Scope
- Remote downloading _(ie server side downloads, rather than client side local downloading)_
- Displaying Tidal data _(album covers, artist info, etc)_
- Any Tidal client-like features _(ie viewing your playlists, browsing, etc)_
- Search functionality _(good idea, but outside of scope for now)_


## For personal use only. Created as a hobby project / for educational purposes
## Remember to support your favorite artists - buy their albums, go to their shows! 
