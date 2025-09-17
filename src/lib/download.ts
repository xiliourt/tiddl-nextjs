'use client';

import axios from 'axios';
import { AuthResponse } from '@/types/auth';
import { Config } from '@/types/config';
import { ProgressItem } from '@/types/download';
import { formatResourceName } from '@/lib/utils';
import { addTaskToQueue, setMaxConcurrentDownloads } from '@/lib/queue';
import { TidalApiItem } from '@/types/tidal';
import { updateProgressState } from '@/components/Progress';
import { downloadAndSaveTrack } from './downloadTrack';

const _downloadTrackLogic = async (
    trackId: string,
    formattedTitle: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle,
    parentId?: string,
    grandparentId?: string
) => {
    const updateTrackProgress = (updater: (trackProgress: ProgressItem) => ProgressItem) => {
        setProgress(p => updateProgressState(p, trackId, updater, parentId, grandparentId));
    };

    await downloadAndSaveTrack(
        trackId,
        formattedTitle,
        auth,
        config,
        dirHandle,
        updateTrackProgress
    );
};

export const downloadAlbum = async (
    albumId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle,
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
            
            const tracks = response.data.items.filter((item: TidalApiItem) => item.type === 'track').map((item: TidalApiItem) => item.item);
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
    dirHandle: FileSystemDirectoryHandle
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

            const tracks = response.data.items.filter((item: TidalApiItem) => item.type === 'track').map((item: TidalApiItem) => item.item);

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
    dirHandle: FileSystemDirectoryHandle
) => {
    const getArtistAlbums = async (artistId: string, singles: boolean) => {
        let offset = 0;
        let allAlbums: { id: string; title: string }[] = [];
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

        let albumsToDownload: { id: string; title: string }[] = [];
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
    dirHandle: FileSystemDirectoryHandle
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