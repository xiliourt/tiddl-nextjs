export interface ProgressItem {
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
    items?: { [id: string]: ProgressItem };
}

export type SetProgressFn = (update: ProgressItem) => void;
