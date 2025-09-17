'use client';

import React, { useState, memo } from 'react';
import { downloadFile } from '@/lib/download';

export interface ProgressItem {
    id: string;
    type: 'track' | 'album' | 'playlist' | 'artist';
    title: string;
    progress: number;
    message: string;
    status?: 'queued' | 'downloading' | 'completed' | 'error';
    stream?: ArrayBuffer;
    fileExtension?: string;
    items?: { [id: string]: ProgressItem };
}

interface ItemProps {
    item: ProgressItem;
}

const getProgressColor = (item: ProgressItem) => {
    if (item.status === 'error') return 'progress-bar-error';
    if (item.progress === 100) return 'progress-bar-completed';
    return 'progress-bar-downloading';
};

const Track: React.FC<ItemProps> = memo(({ item }) => {
    return (
        <div className="status-item">
            <div className="status-item-header">
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
                {item.progress === 100 && (
                    <button onClick={() => downloadFile(item)} className="button download-button">
                        Download
                    </button>
                )}
            </div>
        </div>
    );
});
Track.displayName = 'Track';

const Album: React.FC<ItemProps> = memo(({ item }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleCollapse = () => setIsCollapsed(prev => !prev);
    const isParent = item.items && Object.keys(item.items).length > 0;

    return (
        <div className="status-item">
            <div className="status-item-header" onClick={toggleCollapse}>
                {isParent && <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>}
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
                {item.progress === 100 && (
                    <button onClick={() => downloadFile(item)} className="button download-button">
                        Download
                    </button>
                )}
            </div>
            {isParent && !isCollapsed && (
                <div className="status-item-children">
                    {Object.values(item.items!).map(track => <Track key={track.id} item={track} />)}
                </div>
            )}
        </div>
    );
});
Album.displayName = 'Album';

const Playlist: React.FC<ItemProps> = memo(({ item }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleCollapse = () => setIsCollapsed(prev => !prev);
    const isParent = item.items && Object.keys(item.items).length > 0;

    return (
        <div className="status-item">
            <div className="status-item-header" onClick={toggleCollapse}>
                {isParent && <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>}
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
                {item.progress === 100 && (
                    <button onClick={() => downloadFile(item)} className="button download-button">
                        Download
                    </button>
                )}
            </div>
            {isParent && !isCollapsed && (
                <div className="status-item-children">
                    {Object.values(item.items!).map(track => <Track key={track.id} item={track} />)}
                </div>
            )}
        </div>
    );
});
Playlist.displayName = 'Playlist';

const Artist: React.FC<ItemProps> = memo(({ item }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleCollapse = () => setIsCollapsed(prev => !prev);
    const isParent = item.items && Object.keys(item.items).length > 0;

    return (
        <div className="status-item">
            <div className="status-item-header" onClick={toggleCollapse}>
                {isParent && <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>}
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
                {item.progress === 100 && (
                    <button onClick={() => downloadFile(item)} className="button download-button">
                        Download
                    </button>
                )}
            </div>
            {isParent && !isCollapsed && (
                <div className="status-item-children">
                    {Object.values(item.items!).map(album => <Album key={album.id} item={album} />)}
                </div>
            )}
        </div>
    );
});
Artist.displayName = 'Artist';


interface ProgressProps {
    items: { [id: string]: ProgressItem };
}

const Progress: React.FC<ProgressProps> = ({ items }) => {
    return (
        <div className="status">
            {Object.values(items).map((item) => {
                switch (item.type) {
                    case 'track':
                        return <Track key={item.id} item={item} />;
                    case 'album':
                        return <Album key={item.id} item={item} />;
                    case 'playlist':
                        return <Playlist key={item.id} item={item} />;
                    case 'artist':
                        return <Artist key={item.id} item={item} />;
                    default:
                        return null;
                }
            })}
        </div>
    );
};

export default memo(Progress);