import type { TidalApiItem } from '@/types/tidal';
import type { AuthResponse } from '@/types/auth';
import type { Config } from '@/types/config';
import type { ProgressItem, SetProgressFn } from '@/types/progress';

export type DownloadItemFn = (
    item: TidalApiItem,
    auth: AuthResponse,
    config: Config,
    setProgress: SetProgressFn,
    dirHandle: FileSystemDirectoryHandle,
) => Promise<void>;


export type DownloadSpecificItemFn = (
    itemId: string,
    auth: AuthResponse,
    config: Config,
    setProgress: SetProgressFn,
    dirHandle: FileSystemDirectoryHandle
) => Promise<void>;




