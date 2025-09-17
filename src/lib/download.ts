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


export const downloadFile = (item: ProgressItem) => {
    if (item.type === 'album' || item.type === 'playlist' || item.type === 'artist') {
        if (item.items) {
            for (const subItem of Object.values(item.items)) {
                downloadFile(subItem);
            }
        }
        return;
    }

    if (!item.stream) return;
    const blob = new Blob([item.stream], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title}${item.fileExtension}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

const _downloadTrackLogic = async (
    trackId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    parentId?: string
) => {
    const updateTrackProgress = (updater: (trackProgress: ProgressItem) => ProgressItem) => {
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent || !parent.items) return p;
                const track = parent.items[trackId];
                const updatedTrack = updater(track);
                const updatedItems = { ...parent.items, [trackId]: updatedTrack };

                const totalProgress = Object.values(updatedItems).reduce((acc, item) => acc + item.progress, 0);
                const parentProgress = Math.round(totalProgress / (Object.keys(updatedItems).length * 100) * 100);

                return { ...p, [parentId]: { ...parent, progress: parentProgress, items: updatedItems } };
            });
        } else {
            setProgress(p => ({ ...p, [trackId]: updater(p[trackId]) }));
        }
    };

    try {
        updateTrackProgress(track => ({ ...track, message: 'Downloading...', status: 'downloading' }));

        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { audioquality: config.download.quality, playbackmode: 'STREAM', assetpresentation: 'FULL' },
        });

        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
        updateTrackProgress(track => ({ ...track, fileExtension }));

        const streamData: ArrayBuffer[] = [];
        for (const url of urls) {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                onDownloadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        updateTrackProgress(track => ({ ...track, progress: percentCompleted }));
                    }
                },
            });
            streamData.push(response.data);
        }

        const blob = new Blob(streamData);
        const stream = await blob.arrayBuffer();
        updateTrackProgress(track => ({ ...track, progress: 100, message: 'Download complete', stream, status: 'completed' }));

    } catch (error) {
        console.error(`Failed to download track ${trackId}`, error);
        updateTrackProgress(track => ({ ...track, message: 'Error downloading track', status: 'error' }));
    }
};


export const downloadAlbum = async (
    albumId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
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
        while (true) {
            const response = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
                headers: { Authorization: `Bearer ${auth.access_token}` },
                params: { countryCode: auth.user.countryCode, limit: 100, offset },
            });
            
            const tracks = response.data.items.filter((item: any) => item.type === 'track').map((item: any) => item.item);

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
                    const parent = p[parentId!];
                    if (!parent || !parent.items) return p;

                    const album = parent.items[albumId];
                    if (!album) return p;

                    const updatedAlbum = {
                        ...album,
                        items: {
                            ...(album.items || {}),
                            [track.id.toString()]: trackProgressItem,
                        },
                    };

                    const updatedParentItems = {
                        ...parent.items,
                        [albumId]: updatedAlbum,
                    };

                    return {
                        ...p,
                        [parentId!]: {
                            ...parent,
                            items: updatedParentItems,
                        },
                    };
                });
                
                addTaskToQueue(() => _downloadTrackLogic(track.id.toString(), auth, config, setProgress, albumId));
            }

            offset += response.data.limit;
            if (offset >= response.data.totalNumberOfItems) break;
        }

    } catch (error) {
        console.error(`Failed to download album ${albumId}`, error);
    }
};

export const downloadPlaylist = async (
    playlistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
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

                addTaskToQueue(() => _downloadTrackLogic(track.id.toString(), auth, config, setProgress, playlistId));
                trackIndex++;
            }

            offset += response.data.limit;
            if (offset >= response.data.totalNumberOfItems) break;
        }

    } catch (error) {
        console.error(`Failed to download playlist ${playlistId}`, error);
    }
};

export const downloadArtist = async (
    artistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
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
            }
        }));

        for (const album of albumsToDownload) {
            downloadAlbum(album.id.toString(), auth, config, setProgress, artistId);
        }

    } catch (error) {
        console.error(`Failed to download artist ${artistId}`, error);
    }
};

export const downloadTrack = async (
    trackId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
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

        addTaskToQueue(() => _downloadTrackLogic(trackId, auth, config, setProgress));

    } catch (error) {
        console.error(`Failed to fetch track info for ${trackId}`, error);
        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], message: 'Error fetching track info', status: 'error' } }));
    }
};