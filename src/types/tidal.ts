export type ResourceType = 'track' | 'video' | 'album' | 'playlist' | 'artist';
export type ApiResourceType = 'tracks' | 'videos' | 'albums' | 'playlists' | 'artists';

export type TidalResource = {
    type: ResourceType;
    apiType: ApiResourceType;
    id: string;
}

export interface TidalTrack {
    id: number;
    title: string;
    duration: number;
    replayGain: number;
    peak: number;
    allowStreaming: boolean;
    streamReady: boolean;
    adSupportedStreamReady: boolean;
    djReady: boolean;
    stemReady: boolean;
    streamStartDate?: string | null;
    premiumStreamingOnly: boolean;
    trackNumber: number;
    volumeNumber: number;
    version?: string | null;
    popularity: number;
    copyright?: string | null;
    bpm?: number | null;
    url: string;
    isrc: string;
    editable: boolean;
    explicit: boolean;
    audioQuality: string;
    audioModes: string[];
    mediaMetadata: Record<string, string[]>;
    artist?: { name: string } | null;
    artists: { name: string }[];
    album: { title: string; id: string };
    mixes?: Record<string, string> | null;
}

export interface TidalVideo {
    id: number;
    title: string;
    volumeNumber: number;
    trackNumber: number;
    releaseDate?: string | null;
    imagePath?: string | null;
    imageId: string;
    vibrantColor?: string | null;
    duration: number;
    quality: string;
    streamReady: boolean;
    adSupportedStreamReady: boolean;
    djReady: boolean;
    stemReady: boolean;
    streamStartDate?: string | null;
    allowStreaming: boolean;
    explicit: boolean;
    popularity: number;
    type: string;
    adsUrl?: string | null;
    adsPrePaywallOnly: boolean;
    artist?: { name: string } | null;
    artists: { name: string }[];
    album?: { title: string; id: string } | null;
}

export interface TidalApiItem {
    item: TidalTrack | TidalVideo;
    type: 'track' | 'video';
}
