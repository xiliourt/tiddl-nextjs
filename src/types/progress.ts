export type ProgressItem = {
    id: string;
    type: 'track' | 'album' | 'playlist' | 'artist';
    title: string;
    progress: number;
    message: string;
    status?: 'queued' | 'downloading' | 'completed' | 'error' | 'skipped';
    speed?: number;
    startTime?: number;
    downloadedBytes?: number;
    stream?: ArrayBuffer;
    fileExtension?: string;
    items?: { [tidalResourceId: string]: ProgressItem };
}

export type ProgressItemFn = (
    id: string,
    type: 'track' | 'album' | 'playlist' | 'artist',
    title: string,
    progress: number,
    message: string,
    status?: 'queued' | 'downloading' | 'completed' | 'error' | 'skipped',
    speed?: number,
    startTime?: number,
    downloadedBytes?: number,
    stream?: ArrayBuffer,
    fileExtension?: string,
    items?: { [id: string]: ProgressItem }
) => void,
