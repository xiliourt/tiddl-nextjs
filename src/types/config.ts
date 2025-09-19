export type Config = {
    template: {
        track: string;
        video: string;
        album: string;
        playlist: string;
    };
    download: {
        quality: 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';
        singles_filter: 'none' | 'only' | 'include';
        download_video: boolean;
        threads: number;
    };
};
