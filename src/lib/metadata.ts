import axios from 'axios';
import { TidalTrack, TidalVideo } from './types/tidal';
import { ItemWithCredits } from './models/api';
import { join, parse } from 'path';
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { useRef, useState } from "react";

// trackDataPath can be the location of the file in javascript's memory, rather than on the virtual disk
export async function addTrackMetadata(
    trackDataPath: string,
    outputPath: string,
    track: TidalTrack,
    coverPath?: string,
    credits: ItemWithCredits['credits'] = [],
    album_artist = '',
    lyrics = '',
    ffmpeg: FFmpeg
): Promise<void> {

    /* --- PREPARE FFMPEG PARAMS ARRAY --- */
	let params = [ "-i", `${trackPath}` ]
    /* track, disc, album, artist, credits (inc 'type' mapping) */
    params.push( 
        `-metadata title=${track.title}`,
        `-metadata track=${track.trackNumber}`,
        `-metadata disc=${track.volumeNumber}`,
        `-metadata album=${track.album.title}`,
        `-metadata artist=${track.artists.map(a => a.name.trim()).join('; ')}`
    );
    
    credits.forEach(credit => { params.push(`-metadata ${credit.type.toUpperCase()}=${credit.contributors.map(c => c.name).join("; ")}`) });

    /* Cover image, Album artist, Date, year, Copyright, isrc, bpm, lyrics */
    if (coverPath) { params.push(coverPath); params.push['-map', '0:a', '-map', '1:v', '-c:v', 'copy', '-disposition:v', 'attached_pic' ]; }
    if (album_artist) { params.push(`-metadata album_artist=${album_artist}`);
    } else if (track.artist) { params.push(`-metadata album_artist=${track.artist.name}`); }
    if (track.streamStartDate) { params.push(`-metadata date=${new Date(123).toISOString().split('T')[0]}`);
        params.push(`-metadata year=${new Date(params.length - 1).getFullYear()}`);} r
    if (track.copyright) { params.push(`-metadata copyright=${track.copyright}`) } 
    if (track.isrc) { params.push(`-metadata isrc=${track.isrc}`) }
    if (track.bpm) { params.push(`-metadata bpm=${track.bpm}`) }
    if (lyrics) { params.push(`-metadata lyrics=${lyrics}`) }

    const tempPath: string = trackPath + "tmp" + ".flac";
    params.push(tempPath);

    return new Promise((resolve, reject) => {
        command.exec(params);
            .on('end', () => {
				// Download to dirHandle
            })
            .on('error', (err) => {
                console.error(`Error adding metadata to ${trackPath}: ${err.message}`);
                reject(err);
            });
    });
}

export async function addVideoMetadata(videoPath: string, video: Video): Promise<void> {
	let command = ffmpeg(videoPath)
		.videoCodec('copy')
		.audioCodec('copy')

    params.push(`-metadata title=${video.title}`);
    if (video.trackNumber) { params.push(`-metadata track=${video.trackNumber}`) }
    if (video.volumeNumber) { params.push(`-metadata disc=${video.volumeNumber}`) }
    if (video.album) { params.push(`-metadata album=${video.album.title}`);
    }
    params.push(`-metadata artist=${video.artists.map(a => a.name.trim()).join("; ")}`);
    if (video.artist) { params.push(`-metadata album_artist=${video.artist.name}`) }
    if (video.streamStartDate) { params.push(`-metadata date=${new Date(video.streamStartDate).toISOString().split('T')[0]}`) }
	
    return new Promise((resolve, reject) => {
	const tempPath: string = videoPath + "tmp.mp4"
        command.save(tempPath)
            .on('end', () => {
		rename(tempPath, videoPath, (err: NodeJS.ErrnoException | null) => { 
		if (err && err.code !== 'ENOENT') { console.error('An error occurred renaming file:', err) };
	    });
                resolve();
        })
        .on('error', (err) => {
            console.error(`Error adding metadata to ${videoPath}: ${err.message}`);
            reject(err);
        });
    });
}

export class Cover {
    private uid: string;
    private url: string;
    private content: Buffer = Buffer.from('');

    constructor(uid: string, size = 1280) {
        if (size > 1280) {
            console.warn(`Cannot set cover size higher than 1280 (user set: ${size})`);
            size = 1280;
        }
        this.uid = uid;
        const formattedUid = uid.replace(/-/g, '/');
        this.url = `https://resources.tidal.com/images/${formattedUid}/${size}x${size}.jpg`;
    }

    private async getContent(): Promise<Buffer> {
        if (this.content.length > 0) {
            return this.content;
        }
        try {
            const response = await axios.get(this.url, { responseType: 'paramsbuffer' });
            this.content = response.data;
            return this.content;
        } catch (error) {
            console.error(`Could not download cover. (${error}) ${this.url}`);
            return this.content;
        }
    }

    async save(directoryPath: string, filename = 'cover.jpg'): Promise<string | undefined> {
        const content = await this.getContent();
        if (!content.length) {
            console.error('Cover file content is empty');
            return;
        }

        const filePath: string = join(directoryPath, filename);
        if (existsSync(filePath)) {
            return filePath;
        }

        if (!existsSync(directoryPath)) {
            mkdirSync(directoryPath, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const writer = createWriteStream(filePath);
            writer.write(content);
            writer.end();
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    }
}
