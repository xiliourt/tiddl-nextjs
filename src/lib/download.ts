'use client';

import axios from 'axios';
import { AuthResponse } from '@/types/auth';
import { Config } from '@/types/config';
import { ProgressItem } from '@/types/progress';
import { formatResourceName } from '@/lib/utils';
import { addTaskToQueue, setMaxConcurrentDownloads } from '@/lib/queue';
import { TidalApiItem, TidalResource } from '@/types/tidal';
import { updateProgressState } from '@/components/Progress';
import { downloadAndSaveTrack } from './downloadTrack';
import { fetchItemInfo } from './api.ts'

const downloadFunctions = async (id: string, auth: AuthResponse, config: Config, setProgress: (update: ProgressItem) => void, dirHandle: FileSystemDirectoryHandle) => void } = {
    track: downloadTrack,
    album: downloadAlbum,
    playlist: downloadPlaylist,
    artist: downloadArtist,
};


export const downloadItem: DownloadItemFn = async ({
    item,
    auth,
    config,
    setProgress,
    dirHandle
  }: DownloadItemParams) => { 
    if (downloadFunctions[item.type]) {
      await downloadFunctions[item.type](item, auth, config, setProgress, dirHandle);
    } else {
      console.error(`No download function available for type: ${item.type}`);
    }
};


const _downloadTrackLogic = async (
    itemId: string,
    formattedTitle: string,
    auth: AuthResponse,
    config: Config,
    setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>,
    dirHandle: FileSystemDirectoryHandle,
    parentId?: string,
    grandparentId?: string
) => {
    const updateTrackProgress = (updater: (trackProgress: ProgressItem) => ProgressItem) => {
        setProgress(p => updateProgressState(p, itemId, updater, parentId, grandparentId));
    };

    await downloadAndSaveTrack(
        itemId,
        formattedTitle,
        auth,
        config,
        dirHandle,
        updateTrackProgress
    );
};

export const downloadAlbum = async (
    albumResource: TidalResource,
    auth: AuthResponse,
    config: Config,
    setProgress: >,
    dirHandle: FileSystemDirectoryHandle,
    parentId?: string
) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const albumProgressItem: ProgressItem = {
            id: albumResource.id,
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
                const existingAlbum = parent.items?.[albumResource.id] || {};
                return { ...p, [parentId]: { ...parent, items: { ...(parent.items || {}), [albumResource.id]: { ...existingAlbum, ...albumProgressItem } } } };
            });
        } else {
            setProgress(p => ({ ...p, [albumResource.id]: { ...(p[albumResource.id] || {}), ...albumProgressItem } }));
        }

        let offset = 0;
        let totalTracks = 0;
        while (true) {
            const response = await axios.get(`https://api.tidal.com/v1/albums/${albumResource.id}/items`, {
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
                        const album = parent.items[albumResource.id];
                        if (!album) return p;
                        const updatedAlbum = { ...album, items: { ...(album.items || {}), [track.id.toString()]: trackProgressItem } };
                        return { ...p, [parentId]: { ...parent, items: { ...parent.items, [albumResource.id]: updatedAlbum } } };
                    } else {
                        const album = p[albumResource.id];
                        if (!album) return p;
                        return { ...p, [albumResource.id]: { ...album, items: { ...(album.items || {}), [track.id.toString()]: trackProgressItem } } };
                    }
                });
                
                addTaskToQueue(() => _downloadTrackLogic(track.id.toString(), formattedTitle, auth, config, setProgress, dirHandle, albumResource.id, parentId));
            }

            offset += response.data.limit;
            if (offset >= response.data.totalNumberOfItems) break;
        }

        const finalMessage = `Queued ${totalTracks} tracks`;
        if (parentId) {
            setProgress(p => {
                const parent = p[parentId];
                if (!parent || !parent.items) return p;
                const album = parent.items[albumResource.id];
                if (!album) return p;
                return { ...p, [parentId]: { ...parent, items: { ...parent.items, [albumResource.id]: { ...album, message: finalMessage } } } };
            });
        } else {
            setProgress(p => {
                const album = p[albumResource.id];
                if (!album) return p;
                return { ...p, [albumResource.id]: { ...album, message: finalMessage } };
            });
        }

    } catch (error) {
        console.error(`Failed to download album ${albumResource.id}`, error);
    }
};

export const downloadPlaylist: DownloadItemFn = async (playlist, auth, config, setProgress, dirHandle) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const playlistInfo = fetchItemInfo(playlist);

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
            const response = fetchTidalItems(playlistResource.id, auth, offset)

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

export const downloadArtist: DownloadItemFn = async (artistResource, auth, config, setProgress, dirHandle) => {
    const getArtistAlbums = async (artist: string, singles: boolean) => {
        let offset = 0;
        let allAlbums: { id: string; title: string }[] = [];
        while (true) {
            const albums = await axios.get(`https://api.tidal.com/v1/artists/${artistResource.id}/albums`, {
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
        const artistInfo = fetchItemInfo(artistResource);

        let albumsToDownload: { id: string; title: string }[] = [];
        if (config.download.singles_filter === 'only') {
            albumsToDownload = await getArtistAlbums(artistResource.id, true);
        } else if (config.download.singles_filter === 'include') {
            const regularAlbums = await getArtistAlbums(artistResource.id, false);
            const singleAlbums = await getArtistAlbums(artistResource.id, true);
            albumsToDownload = [...regularAlbums, ...singleAlbums];
        } else {
            albumsToDownload = await getArtistAlbums(artistResource.id, false);
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

        for (const album of albumsToDownload) { downloadAlbum(album.id.toString(), auth, config, setProgress, dirHandle, artistId); }

        setProgress(p => {
            const artist = p[artistId];
            if (!artist) return p;
            return { ...p, [artistId]: { ...artist, message: 'Downloading...' } };
        });

    } catch (error) {
        console.error(`Failed to download artist ${artistId}`, error);
    }
};

export const downloadTrack: DownloadItemFn = async (track: TidalTrack, auth, config, setProgress, dirHandle) => {
    setMaxConcurrentDownloads(config.download.threads);
    try {
        const trackInfo = fetchItemInfo(track);
        const formattedTitle = formatResourceName(config.template.track, trackInfo.data);
        setProgress(p => ({...p, [TidalResource.id]: { id: TidalResource.id, type: 'track', title: formattedTitle, progress: 0, message: 'Queued', status: 'queued' }}));

        addTaskToQueue(() => _downloadTrackLogic(TidalResource.id, formattedTitle, auth, config, setProgress, dirHandle));

    } catch (error) {
        console.error(`Failed to fetch track info for ${trackId}`, error);
        setProgress(p => ({ ...p, [TidalResource.id]: { ...p[TidalResource.id], message: 'Error fetching track info', status: 'error' } }));
    }
};
