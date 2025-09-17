'use client';

import axios from 'axios';
import { AuthResponse } from '@/lib/auth';
import { Config } from '@/types/config';
import { ProgressItem } from '@/components/Progress';
import { parseTrackStream, formatResourceName } from '@/lib/utils';

// --- Download Queue ---
let downloadQueue: (() => Promise<void>)[] = [];
let currentlyDownloading = 0;
let maxConcurrentDownloads = 4;

const setMaxConcurrentDownloads = (threads: number) => {
    maxConcurrentDownloads = threads || 4;
}

const processQueue = async () => {
    if (currentlyDownloading >= maxConcurrentDownloads || downloadQueue.length === 0) {
        return;
    }

    while (currentlyDownloading < maxConcurrentDownloads && downloadQueue.length > 0) {
        currentlyDownloading++;
        const task = downloadQueue.shift();
        if (task) {
            try {
                await task();
            } catch (error) {
                console.error("A download task failed:", error);
            } finally {
                currentlyDownloading--;
                processQueue();
            }
        } else {
             currentlyDownloading--;
        }
    }
}

const addTaskToQueue = (task: () => Promise<void>) => {
    downloadQueue.push(task);
    processQueue();
}
// --- End Download Queue ---

const _downloadTrackLogic = async (
    trackId: string,
    formattedTitle: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle | null,
    parentId?: string,
    grandparentId?: string
) => {
    let lastLoaded = 0;
    let lastTimestamp = Date.now();

    const updateTrackProgress = (updater: (trackProgress: ProgressItem) => ProgressItem) => {
        setProgress(p => {
            if (grandparentId && parentId) {
                // Artist -> Album -> Track
                const grandparent = p[grandparentId];
                if (!grandparent || !grandparent.items) return p;
                const parent = grandparent.items[parentId];
                if (!parent || !parent.items) return p;
                const track = parent.items[trackId];
                if (!track) return p;

                const updatedTrack = updater(track);
                const updatedParentItems = { ...parent.items, [trackId]: updatedTrack };
                
                const completedParentItems = Object.values(updatedParentItems).filter(item => item.progress === 100).length;
                const parentTotalProgress = Object.values(updatedParentItems).reduce((acc, item) => acc + item.progress, 0);
                const parentProgress = Math.round(parentTotalProgress / (Object.keys(updatedParentItems).length * 100) * 100);
                const parentDownloadedBytes = Object.values(updatedParentItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
                const parentTimeElapsed = Date.now() - (parent.startTime || 0);
                const parentSpeed = parentTimeElapsed > 0 ? (parentDownloadedBytes / parentTimeElapsed) * 1000 / (1024 * 1024) : 0;
                const parentMessage = parentProgress === 100 ? 'Download complete' : `Downloaded ${completedParentItems} of ${Object.keys(updatedParentItems).length} tracks`;

                const updatedParent = { ...parent, progress: parentProgress, items: updatedParentItems, message: parentMessage, speed: parentSpeed, downloadedBytes: parentDownloadedBytes };
                const updatedGrandparentItems = { ...grandparent.items, [parentId]: updatedParent };

                const completedGrandparentItems = Object.values(updatedGrandparentItems).filter(item => item.progress === 100).length;
                const grandparentTotalProgress = Object.values(updatedGrandparentItems).reduce((acc, item) => acc + item.progress, 0);
                const grandparentProgress = Math.round(grandparentTotalProgress / (Object.keys(updatedGrandparentItems).length * 100) * 100);
                const grandparentDownloadedBytes = Object.values(updatedGrandparentItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
                const grandparentTimeElapsed = Date.now() - (grandparent.startTime || 0);
                const grandparentSpeed = grandparentTimeElapsed > 0 ? (grandparentDownloadedBytes / grandparentTimeElapsed) * 1000 / (1024 * 1024) : 0;
                const grandparentMessage = grandparentProgress === 100 ? 'Download complete' : `Downloaded ${completedGrandparentItems} of ${Object.keys(updatedGrandparentItems).length} albums`;

                return { ...p, [grandparentId]: { ...grandparent, progress: grandparentProgress, items: updatedGrandparentItems, message: grandparentMessage, speed: grandparentSpeed, downloadedBytes: grandparentDownloadedBytes } };

            } else if (parentId) {
                // Album/Playlist -> Track
                const parent = p[parentId];
                if (!parent || !parent.items) return p;
                const track = parent.items[trackId];
                if (!track) return p;
                const updatedTrack = updater(track);
                const updatedItems = { ...parent.items, [trackId]: updatedTrack };

                const completedItems = Object.values(updatedItems).filter(item => item.progress === 100).length;
                const totalProgress = Object.values(updatedItems).reduce((acc, item) => acc + item.progress, 0);
                const parentProgress = Math.round(totalProgress / (Object.keys(updatedItems).length * 100) * 100);
                const parentDownloadedBytes = Object.values(updatedItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
                const parentTimeElapsed = Date.now() - (parent.startTime || 0);
                const parentSpeed = parentTimeElapsed > 0 ? (parentDownloadedBytes / parentTimeElapsed) * 1000 / (1024 * 1024) : 0;
                const parentMessage = parentProgress === 100 ? 'Download complete' : `Downloaded ${completedItems} of ${Object.keys(updatedItems).length} tracks`;

                return { ...p, [parentId]: { ...parent, progress: parentProgress, items: updatedItems, message: parentMessage, speed: parentSpeed, downloadedBytes: parentDownloadedBytes } };
            } else {
                // Standalone Track
                const track = p[trackId];
                if (!track) return p;
                return { ...p, [trackId]: updater(track) };
            }
        });
    };

    try {
        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { audioquality: config.download.quality, playbackmode: 'STREAM', assetpresentation: 'FULL' },
        });

        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
        updateTrackProgress(track => ({ ...track, fileExtension }));

        if (dirHandle) {
            const pathParts = formattedTitle.split('/');
            const fileName = pathParts.pop() + fileExtension;
            let currentDir = dirHandle;

            for (const part of pathParts) {
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }

            try {
                await currentDir.getFileHandle(fileName);
                updateTrackProgress(track => ({ ...track, progress: 100, message: 'Skipped - File Exists', status: 'skipped' }));
                return;
            } catch (error) {
                // File does not exist, proceed with download
            }
        }

        updateTrackProgress(track => ({ ...track, message: 'Downloading...', status: 'downloading' }));

        const streamData: ArrayBuffer[] = [];
        for (const url of urls) {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                onDownloadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const now = Date.now();
                        const bytesDiff = progressEvent.loaded - lastLoaded;
                        const timeDiff = now - lastTimestamp;
                        const speed = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 / (1024 * 1024) : 0; // MB/s
                        
                        lastLoaded = progressEvent.loaded;
                        lastTimestamp = now;

                        const percentCompleted = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        updateTrackProgress(track => ({ ...track, progress: percentCompleted, speed, downloadedBytes: progressEvent.loaded }));
                    }
                },
            });
            streamData.push(response.data);
        }

        const blob = new Blob(streamData);
        
        if (dirHandle) {
            const pathParts = formattedTitle.split('/');
            const fileName = pathParts.pop() + fileExtension;
            let currentDir = dirHandle;

            for (const part of pathParts) {
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }

            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            updateTrackProgress(track => ({ ...track, progress: 100, message: 'Saved', stream: undefined, status: 'completed', speed: 0 }));
        }

    } catch (error) {
        console.error(`Failed to download track ${trackId}`, error);
        updateTrackProgress(track => ({ ...track, message: 'Error downloading track', status: 'error', speed: 0 }));
    }
};


export const downloadAlbum = async (
    albumId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle | null,
    parentId?: string
) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const albumInfo = await axios.get(`https://api.tidal.com/v1/albums/${albumId}`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { countryCode: auth.user.countryCode },
        });

        const albumProgressItem: ProgressItem = {
            id: albumId,
            type: 'album',
            title: albumInfo.data.title,
            progress: 0,
            message: 'Fetching tracks...',
            items: {},
            startTime: Date.now(),
            downloadedBytes: 0,
        };

        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent) return p;
                const existingAlbum = parent.items?.[albumId] || {};
                return { ...p, [parentId]: { ...parent, items: { ...(parent.items || {}), [albumId]: { ...existingAlbum, ...albumProgressItem } } } };
            });
        } else {
            setProgress(p => ({ ...p, [albumId]: { ...(p[albumId] || {}), ...albumProgressItem } }));
        }

        let offset = 0;
        let totalTracks = 0;
        while (true) {
            const response = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
                headers: { Authorization: `Bearer ${auth.access_token}` },
                params: { countryCode: auth.user.countryCode, limit: 100, offset },
            });
            
            const tracks = response.data.items.filter((item: any) => item.type === 'track').map((item: any) => item.item);
            totalTracks += tracks.length;

            for (const track of tracks) {
                const formattedTitle = formatResourceName(config.template.album, track, { album_artist: albumInfo.data.artist.name });
                const trackProgressItem: ProgressItem = {
                    id: track.id.toString(),
                    type: 'track',
                    title: formattedTitle,
                    progress: 0,
                    message: 'Queued',
                    status: 'queued',
                };

                setProgress(p => {
                    if (parentId) {
                        const parent = p[parentId];
                        if (!parent || !parent.items) return p;
                        const album = parent.items[albumId];
                        if (!album) return p;
                        const updatedAlbum = { ...album, items: { ...(album.items || {}), [track.id.toString()]: trackProgressItem } };
                        return { ...p, [parentId]: { ...parent, items: { ...parent.items, [albumId]: updatedAlbum } } };
                    } else {
                        const album = p[albumId];
                        if (!album) return p;
                        return { ...p, [albumId]: { ...album, items: { ...(album.items || {}), [track.id.toString()]: trackProgressItem } } };
                    }
                });
                
                addTaskToQueue(() => _downloadTrackLogic(track.id.toString(), formattedTitle, auth, config, setProgress, dirHandle, albumId, parentId));
            }

            offset += response.data.limit;
            if (offset >= response.data.totalNumberOfItems) break;
        }

        const finalMessage = `Queued ${totalTracks} tracks`;
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent || !parent.items) return p;
                const album = parent.items[albumId];
                if (!album) return p;
                return { ...p, [parentId]: { ...parent, items: { ...parent.items, [albumId]: { ...album, message: finalMessage } } } };
            });
        } else {
            setProgress(p => {
                const album = p[albumId];
                if (!album) return p;
                return { ...p, [albumId]: { ...album, message: finalMessage } };
            });
        }

    } catch (error) {
        console.error(`Failed to download album ${albumId}`, error);
    }
};

export const downloadPlaylist = async (
    playlistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle | null
) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const playlistInfo = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { countryCode: auth.user.countryCode },
        });

        setProgress(p => ({
            ...p,
            [playlistId]: {
                id: playlistId,
                type: 'playlist',
                title: playlistInfo.data.title,
                progress: 0,
                message: 'Fetching tracks...',
                items: {},
                startTime: Date.now(),
                downloadedBytes: 0,
            }
        }));

        let offset = 0;
        let trackIndex = 0;
        while (true) {
            const response = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}/items`, {
                headers: { Authorization: `Bearer ${auth.access_token}` },
                params: { countryCode: auth.user.countryCode, limit: 100, offset },
            });

            const tracks = response.data.items.filter((item: any) => item.type === 'track').map((item: any) => item.item);

            for (const track of tracks) {
                const formattedTitle = formatResourceName(config.template.playlist, track, { playlist_title: playlistInfo.data.title, playlist_index: trackIndex + 1 });
                const trackProgressItem: ProgressItem = {
                    id: track.id.toString(),
                    type: 'track',
                    title: formattedTitle,
                    progress: 0,
                    message: 'Queued',
                    status: 'queued',
                };

                setProgress(p => {
                    const playlist = p[playlistId];
                    if (!playlist) return p;
                    return { ...p, [playlistId]: { ...playlist, items: { ...(playlist.items || {}), [track.id.toString()]: trackProgressItem } } };
                });

                addTaskToQueue(() => _downloadTrackLogic(track.id.toString(), formattedTitle, auth, config, setProgress, dirHandle, playlistId));
                trackIndex++;
            }

            offset += response.data.limit;
            if (offset >= response.data.totalNumberOfItems) break;
        }

        setProgress(p => {
            const playlist = p[playlistId];
            if (!playlist) return p;
            return { ...p, [playlistId]: { ...playlist, message: `Queued ${trackIndex} tracks` } };
        });

    } catch (error) {
        console.error(`Failed to download playlist ${playlistId}`, error);
    }
};

export const downloadArtist = async (
    artistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle | null
) => {
    const getArtistAlbums = async (artistId: string, singles: boolean) => {
        let offset = 0;
        let allAlbums: any[] = [];
        while (true) {
            const albums = await axios.get(`https://api.tidal.com/v1/artists/${artistId}/albums`, {
                headers: { Authorization: `Bearer ${auth.access_token}` },
                params: {
                    countryCode: auth.user.countryCode,
                    limit: 100,
                    offset,
                    filter: singles ? 'EPSANDSINGLES' : 'ALBUMS',
                },
            });
            allAlbums = allAlbums.concat(albums.data.items);
            offset += albums.data.limit;
            if (offset >= albums.data.totalNumberOfItems) break;
        }
        return allAlbums;
    };

    try {
        const artistInfo = await axios.get(`https://api.tidal.com/v1/artists/${artistId}`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { countryCode: auth.user.countryCode },
        });

        let albumsToDownload: any[] = [];
        if (config.download.singles_filter === 'only') {
            albumsToDownload = await getArtistAlbums(artistId, true);
        } else if (config.download.singles_filter === 'include') {
            const regularAlbums = await getArtistAlbums(artistId, false);
            const singleAlbums = await getArtistAlbums(artistId, true);
            albumsToDownload = [...regularAlbums, ...singleAlbums];
        } else {
            albumsToDownload = await getArtistAlbums(artistId, false);
        }

        const albumItems: { [id: string]: ProgressItem } = {};
        for (const album of albumsToDownload) {
            albumItems[album.id.toString()] = {
                id: album.id.toString(),
                type: 'album',
                title: album.title,
                progress: 0,
                message: 'Queued',
                status: 'queued',
                items: {},
            };
        }

        setProgress(p => ({
            ...p,
            [artistId]: {
                id: artistId,
                type: 'artist',
                title: artistInfo.data.name,
                progress: 0,
                message: `Queued ${albumsToDownload.length} albums`,
                items: albumItems,
                startTime: Date.now(),
                downloadedBytes: 0,
            }
        }));

        for (const album of albumsToDownload) {
            downloadAlbum(album.id.toString(), auth, config, setProgress, dirHandle, artistId);
        }

        setProgress(p => {
            const artist = p[artistId];
            if (!artist) return p;
            return { ...p, [artistId]: { ...artist, message: 'Downloading...' } };
        });

    } catch (error) {
        console.error(`Failed to download artist ${artistId}`, error);
    }
};

export const downloadTrack = async (
    trackId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle | null
) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const trackInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { countryCode: auth.user.countryCode },
        });

        const formattedTitle = formatResourceName(config.template.track, trackInfo.data);
        setProgress(p => ({
            ...p,
            [trackId]: {
                id: trackId,
                type: 'track',
                title: formattedTitle,
                progress: 0,
                message: 'Queued',
                status: 'queued',
            }
        }));

        addTaskToQueue(() => _downloadTrackLogic(trackId, formattedTitle, auth, config, setProgress, dirHandle));

    } catch (error) {
        console.error(`Failed to fetch track info for ${trackId}`, error);
        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], message: 'Error fetching track info', status: 'error' } }));
    }
};