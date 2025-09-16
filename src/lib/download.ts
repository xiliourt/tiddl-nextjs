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
    parentId?: string,
    onProgress?: (progress: number) => void
) => {
    const updateAlbumProgress = (updater: (albumProgress: ProgressItem) => ProgressItem) => {
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
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
        let downloadedItems = 0;

        updateAlbumProgress(album => ({ ...album, message: `Found ${totalItems} items. Starting download...` }));

        while (true) {
            const albumItems = await axios.get(`https://api.tidal.com/v1/albums/${albumId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of albumItems.data.items) {
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    updateAlbumProgress(album => ({ ...album, items: { ...(album.items || {}), [trackId]: { id: trackId, type: 'track', title: track.title, progress: 0, message: 'Queueing...' } } }));

                    try {
                        const trackInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}`, {
                            headers: { Authorization: `Bearer ${auth?.access_token}` },
                            params: { countryCode: auth?.user.countryCode },
                        });
                        const formattedTitle = formatResourceName(config.template.album, trackInfo.data, { album_artist: albumInfo.data.artist.name });
                        
                        updateAlbumProgress(album => ({ ...album, items: { ...(album.items || {}), [trackId]: { ...album.items![trackId], title: formattedTitle, message: 'Fetching stream URL...' } } }));

                        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
                            headers: { Authorization: `Bearer ${auth?.access_token}` },
                            params: { audioquality: config.download.quality, playbackmode: 'STREAM', assetpresentation: 'FULL' },
                        });

                        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
                        updateAlbumProgress(album => ({ ...album, items: { ...(album.items || {}), [trackId]: { ...album.items![trackId], fileExtension, message: 'Downloading...' } } }));

                        const streamData: ArrayBuffer[] = [];
                        let downloadedSegments = 0;
                        for (const url of urls) {
                            const response = await axios.get(url, { responseType: 'arraybuffer' });
                            streamData.push(response.data);
                            downloadedSegments++;
                            const trackProgress = Math.round((downloadedSegments / urls.length) * 100);
                            updateAlbumProgress(album => ({ ...album, items: { ...(album.items || {}), [trackId]: { ...album.items![trackId], progress: trackProgress } } }));
                        }

                        const blob = new Blob(streamData, { type: 'application/octet-stream' });
                        const stream = await blob.arrayBuffer();
                        downloadedItems++;
                        const albumProgress = Math.round((downloadedItems / totalItems) * 100);

                        updateAlbumProgress(album => ({ ...album, progress: albumProgress, message: `Downloaded ${downloadedItems} of ${totalItems} tracks.`, items: { ...(album.items || {}), [trackId]: { ...album.items![trackId], progress: 100, message: 'Download complete', stream } } }));
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
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
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
        let downloadedItems = 0;

        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], message: `Found ${totalItems} items. Starting download...` } }));

        while (true) {
            const playlistItems = await axios.get(`https://api.tidal.com/v1/playlists/${playlistId}/items`, {
                headers: { Authorization: `Bearer ${auth?.access_token}` },
                params: { countryCode: auth?.user.countryCode, limit: 100, offset },
            });

            for (const item of playlistItems.data.items) {
                if (item.type === 'track') {
                    const track = item.item;
                    const trackId = track.id.toString();

                    setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], items: { ...p[playlistId].items, [trackId]: { id: trackId, type: 'track', title: track.title, progress: 0, message: 'Queueing...' } } } }));

                    try {
                        const trackInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}`, {
                            headers: { Authorization: `Bearer ${auth?.access_token}` },
                            params: { countryCode: auth?.user.countryCode },
                        });
                        const formattedTitle = formatResourceName(config.template.playlist, trackInfo.data, { playlist_title: playlistInfo.data.title, playlist_index: downloadedItems + 1 });
                        
                        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], items: { ...p[playlistId].items, [trackId]: { ...p[playlistId].items![trackId], title: formattedTitle, message: 'Fetching stream URL...' } } } }));

                        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
                            headers: { Authorization: `Bearer ${auth?.access_token}` },
                            params: { audioquality: config.download.quality, playbackmode: 'STREAM', assetpresentation: 'FULL' },
                        });

                        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
                        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], items: { ...p[playlistId].items, [trackId]: { ...p[playlistId].items![trackId], fileExtension, message: 'Downloading...' } } } }));

                        const streamData: ArrayBuffer[] = [];
                        let downloadedSegments = 0;
                        for (const url of urls) {
                            const response = await axios.get(url, { responseType: 'arraybuffer' });
                            streamData.push(response.data);
                            downloadedSegments++;
                            const trackProgress = Math.round((downloadedSegments / urls.length) * 100);
                            setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], items: { ...p[playlistId].items, [trackId]: { ...p[playlistId].items![trackId], progress: trackProgress } } } }));
                        }

                        const blob = new Blob(streamData, { type: 'application/octet-stream' });
                        const stream = await blob.arrayBuffer();
                        downloadedItems++;
                        const playlistProgress = Math.round((downloadedItems / totalItems) * 100);

                        setProgress(p => ({ ...p, [playlistId]: { ...p[playlistId], progress: playlistProgress, message: `Downloaded ${downloadedItems} of ${totalItems} tracks.`, items: { ...p[playlistId].items, [trackId]: { ...p[playlistId].items![trackId], progress: 100, message: 'Download complete', stream } } } }));
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
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
) => {
    const getArtistAlbums = async (artistId: string, singles: boolean) => {
        let offset = 0;
        let allAlbums: any[] = [];
        while (true) {
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
        let albumProgress: { [albumId: string]: number } = {};
        setProgress(p => ({ ...p, [artistId]: { ...p[artistId], message: `Found ${totalAlbums} albums. Starting download...` } }));

        const albumPromises = albumsToDownload.map(album => {
            return downloadAlbum(album.id.toString(), auth, config, setProgress, artistId, (progress) => {
                albumProgress[album.id.toString()] = progress;
                const totalProgress = Object.values(albumProgress).reduce((acc, p) => acc + p, 0);
                const artistProgress = Math.round(totalProgress / (totalAlbums * 100) * 100);
                setProgress(p => ({ ...p, [artistId]: { ...p[artistId], progress: artistProgress, message: `Downloaded ${Object.keys(albumProgress).length} of ${totalAlbums} albums.` } }));
            });
        });

        await Promise.all(albumPromises);

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
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>
) => {
    setProgress(p => ({
        ...p,
        [trackId]: {
            id: trackId,
            type: 'track',
            title: 'Loading...',
            progress: 0,
            message: 'Fetching track info...',
        }
    }));

    try {
        const trackInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: { countryCode: auth?.user.countryCode },
        });

        const formattedTitle = formatResourceName(config.template.track, trackInfo.data);
        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], title: formattedTitle, message: 'Fetching stream URL...' } }));

        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
            headers: { Authorization: `Bearer ${auth?.access_token}` },
            params: {
                audioquality: config.download.quality,
                playbackmode: 'STREAM',
                assetpresentation: 'FULL',
            },
        });

        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], fileExtension, message: 'Downloading...' } }));

        const streamData: ArrayBuffer[] = [];
        let downloadedSegments = 0;

        for (const url of urls) {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
            });
            streamData.push(response.data);
            downloadedSegments++;
            const percentCompleted = Math.round((downloadedSegments / urls.length) * 100);
            setProgress(p => ({ ...p, [trackId]: { ...p[trackId], progress: percentCompleted } }));
        }

        const blob = new Blob(streamData);
        const stream = await blob.arrayBuffer();

        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], progress: 100, message: 'Download complete', stream } }));

    } catch (error) {
        console.error('Failed to download track', error);
        if (axios.isAxiosError(error)) {
            console.error(error.response?.data);
        }
        setProgress(p => ({ ...p, [trackId]: { ...p[trackId], message: 'Error downloading track' } }));
    }
};
