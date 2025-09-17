'use client';

import axios from 'axios';
import { AuthResponse } from '@/lib/auth';
import { Config } from '@/types/config';
import { ProgressItem } from '@/components/Progress';
import { parseTrackStream, formatResourceName } from '@/lib/utils';

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

export const downloadAlbum = async (
    albumId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    isPaused: () => boolean,
    parentId?: string,
    onProgress?: (progress: number) => void
) => {
    const updateAlbumProgress = (updater: (albumProgress: ProgressItem) => ProgressItem) => {
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent) return p;
                const album = parent.items?.[albumId] || { id: albumId, type: 'album', title: '', progress: 0, message: '', items: {} };
                const updatedAlbum = updater(album);
                if (onProgress) onProgress(updatedAlbum.progress);
                return { ...p, [parentId]: { ...parent, items: { ...(parent.items || {}), [albumId]: updatedAlbum } } };
            });
        } else {
            setProgress(p => {
                const album = p[albumId] || { id: albumId, type: 'album', title: '', progress: 0, message: '', items: {} };
                const updatedAlbum = updater(album);
                if (onProgress) onProgress(updatedAlbum.progress);
                return { ...p, [albumId]: updatedAlbum };
            });
        }
    };

    try {
        const albumInfo = await axios.get(`https://api.tidal.com/v1/albums/${albumId}`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode },
        });

        updateAlbumProgress(album => ({
            ...album,
            id: albumId,
            type: 'album',
            title: albumInfo.data.title,
            message: 'Fetching album items...',
            items: album.items || {},
        }));

        let offset = 0;
        const albumItemsResponse = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode, limit: 100, offset: 0 },
        });
        const totalItems = albumItemsResponse.data.totalNumberOfItems;
        
        updateAlbumProgress(album => ({ ...album, message: `Found ${totalItems} items. Waiting to download...` }));

        let downloadedItems = 0;
        while (true) {
            if (isPaused()) break;
            const albumItems = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of albumItems.data.items) {
                if (isPaused()) break;
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    updateAlbumProgress(album => ({ ...album, items: { ...(album.items || {}), [trackId]: { id: trackId, type: 'track', title: track.title, progress: 0, message: 'Queued' } } }));
                }
            }

            offset += albumItems.data.limit;
            if (offset >= totalItems) break;
        }

        offset = 0;
        while (true) {
            if (isPaused()) break;
            const albumItems = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of albumItems.data.items) {
                if (isPaused()) break;
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    try {
                        await downloadTrack(trackId, auth, config, setProgress, isPaused, albumId);
                        downloadedItems++;
                        const albumProgress = Math.round((downloadedItems / totalItems) * 100);
                        updateAlbumProgress(album => ({ ...album, progress: albumProgress, message: `Downloaded ${downloadedItems} of ${totalItems} tracks.` }));
                    } catch (trackError) {
                        console.error(`Failed to download track ${trackId} from album ${albumId}`, trackError);
                        downloadedItems++;
                        const albumProgress = Math.round((downloadedItems / totalItems) * 100);
                        updateAlbumProgress(album => ({ ...album, progress: albumProgress, items: { ...(album.items || {}), [trackId]: { ...album.items![trackId], message: 'Error downloading track' } } }));
                    }
                }
            }

            offset += albumItems.data.limit;
            if (offset >= totalItems) break;
        }

        updateAlbumProgress(album => ({ ...album, progress: 100, message: 'Album download complete' }));
    } catch (error) {
        console.error(`Failed to download album ${albumId}`, error);
        updateAlbumProgress(album => ({ ...album, message: 'Error downloading album' }));
    }
};

export const downloadPlaylist = async (
    playlistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    isPaused: () => boolean
) => {
    try {
        const playlistInfo = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode },
        });

        setProgress(p => ({
            ...p,
            [playlistId]: {
                id: playlistId,
                type: 'playlist',
                title: playlistInfo.data.title,
                progress: 0,
                message: 'Fetching playlist info...',
                items: {},
            }
        }));

        let offset = 0;
        const playlistItemsResponse = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}/items`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode, limit: 100, offset: 0 },
        });
        const totalItems = playlistItemsResponse.data.totalNumberOfItems;
        
        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], message: `Found ${totalItems} items. Waiting to download...` } }));

        let downloadedItems = 0;
        while (true) {
            if (isPaused()) break;
            const playlistItems = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of playlistItems.data.items) {
                if (isPaused()) break;
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], items: { ...p[playlistId].items, [trackId]: { id: trackId, type: 'track', title: track.title, progress: 0, message: 'Queued' } } } }));
                }
            }

            offset += playlistItems.data.limit;
            if (offset >= totalItems) break;
        }

        offset = 0;
        while (true) {
            if (isPaused()) break;
            const playlistItems = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of playlistItems.data.items) {
                if (isPaused()) break;
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    try {
                        await downloadTrack(trackId, auth, config, setProgress, isPaused, playlistId);
                        downloadedItems++;
                        const playlistProgress = Math.round((downloadedItems / totalItems) * 100);
                        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], progress: playlistProgress, message: `Downloaded ${downloadedItems} of ${totalItems} tracks.` } }));
                    } catch (trackError) {
                        console.error(`Failed to download track ${trackId} from playlist ${playlistId}`, trackError);
                        downloadedItems++;
                        const playlistProgress = Math.round((downloadedItems / totalItems) * 100);
                        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], progress: playlistProgress, items: { ...p[playlistId].items, [trackId]: { ...p[playlistId].items![trackId], message: 'Error downloading track' } } } }));
                    }
                }
            }

            offset += playlistItems.data.limit;
            if (offset >= totalItems) break;
        }

        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], progress: 100, message: 'Playlist download complete' } }));
    } catch (error) {
        console.error(`Failed to download playlist ${playlistId}`, error);
        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], message: 'Error downloading playlist' } }));
    }
};

export const downloadArtist = async (
    artistId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    isPaused: () => boolean
) => {
    const getArtistAlbums = async (artistId: string, singles: boolean) => {
        let offset = 0;
        let allAlbums: any[] = [];
        while (true) {
            if (isPaused()) break;
            const albums = await axios.get(`https://api.tidal.com/v1/artists/${artistId}/albums`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: {
                    countryCode: auth?.user.countryCode,
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
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode },
        });

        setProgress(p => ({
            ...p,
            [artistId]: {
                id: artistId,
                type: 'artist',
                title: artistInfo.data.name,
                progress: 0,
                message: 'Fetching artist albums...',
                items: {},
            }
        }));

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

        const totalAlbums = albumsToDownload.length;
        setProgress(p => ({ ...p, [artistId]: { ...p[artistId], message: `Found ${totalAlbums} albums. Waiting to download...` } }));

        for (const album of albumsToDownload) {
            if (isPaused()) break;
            setProgress(p => ({ ...p, [artistId]: { ...p[artistId], items: { ...p[artistId].items, [album.id.toString()]: { id: album.id.toString(), type: 'album', title: album.title, progress: 0, message: 'Queued' } } } }));
        }

        let downloadedAlbums = 0;
        for (const album of albumsToDownload) {
            if (isPaused()) break;
            await downloadAlbum(album.id.toString(), auth, config, setProgress, isPaused, artistId, (progress) => {
                setProgress(p => {
                    const artistProgress = p[artistId];
                    if (!artistProgress) return p;
                    const albumProgress = { ...artistProgress.items![album.id.toString()], progress };
                    const totalProgress = Object.values({ ...artistProgress.items, [album.id.toString()]: albumProgress }).reduce((acc, item) => acc + (item.progress || 0), 0);
                    const newArtistProgress = Math.round(totalProgress / (totalAlbums * 100) * 100);
                    return { ...p, [artistId]: { ...artistProgress, progress: newArtistProgress, message: `Downloaded ${downloadedAlbums} of ${totalAlbums} albums.` } };
                });
            });
            downloadedAlbums++;
        }

        setProgress(p => ({ ...p, [artistId]: { ...p[artistId], progress: 100, message: 'Artist download complete' } }));
    } catch (error) {
        console.error(`Failed to download artist ${artistId}`, error);
        setProgress(p => ({ ...p, [artistId]: { ...p[artistId], message: 'Error downloading artist' } }));
    }
};

export const downloadTrack = async (
    trackId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    isPaused: () => boolean,
    parentId?: string
) => {
    const updateTrackProgress = (updater: (trackProgress: ProgressItem) => ProgressItem) => {
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent) return p;
                const track = parent.items?.[trackId] || { id: trackId, type: 'track', title: '', progress: 0, message: '' };
                const updatedTrack = updater(track);
                return { ...p, [parentId]: { ...parent, items: { ...(parent.items || {}), [trackId]: updatedTrack } } };
            });
        } else {
            setProgress(p => {
                const track = p[trackId] || { id: trackId, type: 'track', title: '', progress: 0, message: '' };
                const updatedTrack = updater(track);
                return { ...p, [trackId]: updatedTrack };
            });
        }
    };

    updateTrackProgress(track => ({ ...track, message: 'Fetching track info...' }));

    try {
        const trackInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode },
        });

        const formattedTitle = formatResourceName(config.template.track, trackInfo.data);
        updateTrackProgress(track => ({ ...track, title: formattedTitle, message: 'Fetching stream URL...' }));

        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: {
                audioquality: config.download.quality,
                playbackmode: 'STREAM',
                assetpresentation: 'FULL',
            },
        });

        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
        updateTrackProgress(track => ({ ...track, fileExtension, message: 'Downloading...' }));

        const streamData: ArrayBuffer[] = [];
        let downloadedSegments = 0;

        for (const url of urls) {
            if (isPaused()) break;
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
            });
            streamData.push(response.data);
            downloadedSegments++;
            const percentCompleted = Math.round((downloadedSegments / urls.length) * 100);
            updateTrackProgress(track => ({ ...track, progress: percentCompleted }));
        }

        const blob = new Blob(streamData);
        const stream = await blob.arrayBuffer();

        updateTrackProgress(track => ({ ...track, progress: 100, message: 'Download complete', stream }));

    } catch (error) {
        console.error('Failed to download track', error);
        if (axios.isAxiosError(error)) {
            console.error(error.response?.data);
        }
        updateTrackProgress(track => ({ ...track, message: 'Error downloading track' }));
    }
};