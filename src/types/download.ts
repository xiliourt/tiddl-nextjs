import type { TidalApiItem } from @/types/tidal
import type { AuthResponse } from @/types/auth
import type { Config } from @/types/config
import type { ProgressItem } from '@/types/progress'

export interface DownloadItemParams {
  item: TidalApiItem;
  auth: AuthResponse;
  config: Config;
  setProgress: SetProgressFn,
  dirHandle: FileSystemDirectoryHandle;
}

export type DownloadItemFn = (params: DownloadItemParams) => void;
