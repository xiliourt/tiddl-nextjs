'use client';

import { useState } from 'react';

export interface ProgressItem {
    id: string;
    type: string;
    title: string;
    progress: number;
    message: string;
    items?: { [id: string]: ProgressItem };
    stream?: ArrayBuffer;
    fileExtension?: string;
}

export const Track: React.FC<{ item: ProgressItem, onDownload: () => void }> = ({ item, onDownload }) => {
    const isCompleted = item.progress === 100;
    return (
        <div id={`track-${item.id}`} className={`status-item ${isCompleted ? 'completed' : ''}`}>
            <strong>{item.type}: {item.title}</strong>
            <div>{item.message}</div>
            <progress value={item.progress} max="100" />
            {isCompleted && <button onClick={onDownload}>Download</button>}
        </div>
    );
};

export const Album: React.FC<{ item: ProgressItem, onDownload: (item: ProgressItem) => void }> = ({ item, onDownload }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isCompleted = item.progress === 100;
    return (
        <div id={`album-${item.id}`} className={`status-item ${isCompleted ? 'completed' : ''}`}>
            <strong onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
                {isCollapsed ? '▶' : '▼'} {item.type}: {item.title}
            </strong>
            <div>{item.message}</div>
            <progress value={item.progress} max="100" />
            {isCompleted && <button onClick={() => onDownload(item)}>Download</button>}
            {!isCollapsed && (
                <div style={{ marginLeft: '20px', marginTop: '10px' }}>
                    {Object.values(item.items || {}).map((track) => (
                        <Track key={`${track.type}-${track.id}`} item={track} onDownload={() => onDownload(track)} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Playlist: React.FC<{ item: ProgressItem, onDownload: (item: ProgressItem) => void }> = ({ item, onDownload }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isCompleted = item.progress === 100;
    return (
        <div id={`playlist-${item.id}`} className={`status-item ${isCompleted ? 'completed' : ''}`}>
            <strong onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
                {isCollapsed ? '▶' : '▼'} {item.type}: {item.title}
            </strong>
            <div>{item.message}</div>
            <progress value={item.progress} max="100" />
            {isCompleted && <button onClick={() => onDownload(item)}>Download</button>}
            {!isCollapsed && (
                <div style={{ marginLeft: '20px', marginTop: '10px' }}>
                    {Object.values(item.items || {}).map((track) => (
                        <Track key={`${track.type}-${track.id}`} item={track} onDownload={() => onDownload(track)} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Artist: React.FC<{ item: ProgressItem, onDownload: (item: ProgressItem) => void }> = ({ item, onDownload }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isCompleted = item.progress === 100;
    return (
        <div id={`artist-${item.id}`} className={`status-item ${isCompleted ? 'completed' : ''}`}>
            <strong onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
                {isCollapsed ? '▶' : '▼'} {item.type}: {item.title}
            </strong>
            <div>{item.message}</div>
            <progress value={item.progress} max="100" />
            {isCompleted && <button onClick={() => onDownload(item)}>Download</button>}
            {!isCollapsed && (
                <div style={{ marginLeft: '20px', marginTop: '10px' }}>
                    {Object.values(item.items || {}).map((album) => (
                        <Album key={`${album.type}-${album.id}`} item={album} onDownload={onDownload} />
                    ))}
                </div>
            )}
        </div>
    );
};
