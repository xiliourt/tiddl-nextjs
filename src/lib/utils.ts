'use client';

import { XMLParser } from 'fast-xml-parser';

export type ResourceType = 'track' | 'video' | 'album' | 'playlist' | 'artist';

export interface TidalResource {
    type: ResourceType;
    id: string;
}

export function tidalResourceFromString(str: string): TidalResource | null {
    try {
        const url = new URL(str);
        const parts = url.pathname.split('/');
        const resourceTypes: ResourceType[] = ['track', 'video', 'album', 'playlist', 'artist'];

        let type: ResourceType | undefined;
        let id: string | undefined;

        for (let i = 0; i < parts.length; i++) {
            if (resourceTypes.includes(parts[i] as ResourceType)) {
                type = parts[i] as ResourceType;
                id = parts[i + 1];
                break;
            }
        }

        if (!type || !id) {
            return null;
        }

        if (type !== 'playlist' && !/^\d+$/.test(id)) {
            return null;
        }

        return { type, id };
    } catch {
        return null;
    }
}

export function sanitizeString(str: string): string {
    return str.replace(/[\":'*?<>|]+/g, '');
}

export function formatResourceName(
    template: string,
    resource: Record<string, string | number | Record<string, string>[]>,
    options: {
        album_artist?: string;
        playlist_title?: string;
        playlist_index?: number;
    } = {}
): string {
    const artist = resource.artist ? resource.artist.name : (resource.artists && resource.artists.length > 0 ? resource.artists[0].name : '');
    const features = resource.artists
        ?.filter((a: { name: string }) => a.name !== artist)
        .map((a: { name: string }) => a.name) ?? [];

    const resourceDict: Record<string, string | number> = {
        id: resource.id,
        title: resource.title,
        artist: artist,
        artists: [...features, artist].join(', '),
        features: features.join(', '),
        album: resource.album ? resource.album.title : '',
        album_id: resource.album ? resource.album.id : '',
        number: resource.trackNumber,
        disc: resource.volumeNumber,
        date: resource.streamStartDate || '',
        year: resource.streamStartDate ? new Date(resource.streamStartDate).getFullYear() : '',
        playlist: options.playlist_title ? options.playlist_title : '',
        album_artist: options.album_artist ? options.album_artist : '',
        playlist_number: options.playlist_index || 0,
        quality: '',
        version: '',
        bpm: '',
    };

    if ('audioQuality' in resource) { // Track
        resourceDict.version = resource.version || '';
        resourceDict.quality = resource.audioQuality;
        resourceDict.bpm = resource.bpm || '';
    } else { // Video
        resourceDict.quality = resource.quality;
    }

    let formatted = template.replace(/{([a-zA-Z_]+)(?::(\d+)d)?}/g, (match, key, padding) => {
        if (key in resourceDict) {
            const value = resourceDict[key];
            if (padding && typeof value === 'number') {
                return String(value).padStart(parseInt(padding, 10), '0');
            }
            return String(value);
        }
        return match; // Keep placeholder if key not found
    });

    formatted = formatted.trim();

    const pathComponents = formatted.split('/').map(c => sanitizeString(c));
    formatted = pathComponents.join('/');

    return formatted;
}

interface TrackManifest {
    mimeType: string;
    codecs: string;
    encryptionType: string;
    urls: string[];
}

function parseManifestXML(xmlContent: string): { urls: string[]; codecs: string } {
    const parser = new XMLParser({ ignoreAttributes: false });
    const jsonObj = parser.parse(xmlContent);

    let mpd = jsonObj['urn:mpeg:dash:schema:mpd:2011:MPD'];
    if (!mpd) {
        mpd = jsonObj['MPD'];
    }
    if (!mpd) {
        console.error("MPD not found in manifest. JSON object keys:", Object.keys(jsonObj));
        throw new Error('Could not find MPD in manifest');
    }

    const representation = mpd.Period.AdaptationSet.Representation;
    const codecs = representation['@_codecs'];
    const segmentTemplate = representation.SegmentTemplate;
    const urlTemplate = segmentTemplate['@_media'];
    const segmentTimeline = segmentTemplate.SegmentTimeline.S;

    let total = 0;
    if (Array.isArray(segmentTimeline)) {
        segmentTimeline.forEach(s => {
            total += 1;
            if (s['@_r']) {
                total += parseInt(s['@_r'], 10);
            }
        });
    } else {
        total = 1 + (parseInt(segmentTimeline['@_r'], 10) || 0);
    }


    const urls = Array.from({ length: total + 1 }, (_, i) => urlTemplate.replace('$Number$', String(i)));

    return { urls, codecs };
}

export function parseTrackStream(trackStream: { manifest: string; manifestMimeType: string; audioQuality: string; trackId: number; }): { urls: string[], fileExtension: string } {
    const decodedManifest = atob(trackStream.manifest);
    let urls: string[];
    let codecs: string;

    switch (trackStream.manifestMimeType) {
        case 'application/vnd.tidal.bts':
            const trackManifest: TrackManifest = JSON.parse(decodedManifest);
            urls = trackManifest.urls;
            codecs = trackManifest.codecs;
            break;
        case 'application/dash+xml':
            ({ urls, codecs } = parseManifestXML(decodedManifest));
            break;
        default:
            throw new Error(`Unknown manifest mime type: ${trackStream.manifestMimeType}`);
    }

    let fileExtension: string;
    if (codecs === 'flac') {
        fileExtension = '.flac';
        if (trackStream.audioQuality === 'HI_RES_LOSSLESS') {
            fileExtension = '.m4a';
        }
    } else if (codecs.startsWith('mp4')) {
        fileExtension = '.m4a';
    } else {
        throw new Error(`Unknown codecs: ${codecs} (trackId ${trackStream.trackId})`);
    }

    return { urls, fileExtension };
}