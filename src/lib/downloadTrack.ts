'use client';

import axios from 'axios';
import { AuthResponse } from '@/types/auth';
import { Config } from '@/types/config';
import { ProgressItem } from '@/types/progress';
import { parseTrackStream } from '@/lib/utils';

export const downloadAndSaveTrack = async (
    trackId: string,
    formattedTitle: string,
    auth: AuthResponse,
    config: Config,
    dirHandle: FileSystemDirectoryHandle,
    updateTrackProgress: (updater: (trackProgress: ProgressItem) => ProgressItem) => void,
) => {
    let lastLoaded = 0;
    let lastTimestamp = Date.now();

    try {
        const streamInfo = await axios.get(`https://api.tidal.com/v1/tracks/${trackId}/playbackinfo`, {
            headers: { Authorization: `Bearer ${auth.access_token}` },
            params: { audioquality: config.download.quality, playbackmode: 'STREAM', assetpresentation: 'FULL' },
        });

        const { urls, fileExtension } = parseTrackStream(streamInfo.data);
        updateTrackProgress(track => ({ ...track, fileExtension }));

        /* -- CLIENT SIDE LOGIC: Create path, file exist check */
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
        } catch {
            // File does not exist, proceed with download
        }
        /* -- END CLIENT SIDE LOGIC */
        
        updateTrackProgress(track => ({ ...track, message: 'Downloading...', status: 'downloading' }));

        /* -- SERVER OR CLIENT: Track Download -- */
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

        /* CLIENT SIDE LOGIC: Save blob to file */
        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        /* END CLIENT SIDE LOGIC */
        
        updateTrackProgress(track => ({ ...track, progress: 100, message: 'Saved', stream: undefined, status: 'completed', speed: 0 }));

    } catch (error) {
        console.error(`Failed to download track ${trackId}`, error);
        updateTrackProgress(track => ({ ...track, message: 'Error downloading track', status: 'error', speed: 0 }));
    }
};
