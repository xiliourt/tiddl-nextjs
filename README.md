# Next.JS / React Tidal Downloader
A full client-side browser-based Tidal downloader, with easy authentication support, advanced configuration settings (such as path and naming schemes), multi threading, and a simplistic UI for a user friendly experience.

### Features
- Easy authentication via generated login authentication link at first load
- Supports track, album, artist and playlist links
- Supports selecting a download directory to download files direct to disk
- Config allows configuring of settings equal to tiddl
  - Full directory structure support (ie {artist}/{artist} - {track}, or {playlist}/{artist} - {track}, etc)
  - Multithreading supported
  - Include/Exclude/Only EPs and singles toggle
  - Download video toggle (not yet functional - video support yet to be added)
  - Track quality toggle
- Automatic token refreshing upon load(also refreshable via the 'refresh token' button)

### Missing Features (to be added)
- Video downloading support
- Refresh token automatically when an error occurs due to expired token
- Extra error handling
  - Catch unexpected Tidal API responses
    - Add models for Tracks, Albums, Artists, Playlist and Video calls, ensuring received data matches
    - Process non 200 status codes, outputting code + response to user
- Clean up code (ie Progress.tsx has a lot of repeated code, it could be one function that handles things based on 'type' ('track', 'album', 'artist', etc)

### Outside of Scope
- Remote downloading _(ie server side downloads, rather than client side local downloading)_
- Displaying Tidal data _(album covers, artist info, etc)_
- Any Tidal client-like features _(ie viewing your playlists, browsing, etc)_
- Search functionality _(good idea, but outside of scope for now)_


## For personal use only. Created as a hobby project / for educational purposes
## Remember to support your favorite artists - buy their albums, go to their shows! 
