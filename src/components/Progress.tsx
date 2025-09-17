'use client';

import React, { useState, memo } from 'react';
import { ProgressItem } from '@/types/progress';

interface ItemProps {
    item: ProgressItem;
}

const getProgressColor = (item: ProgressItem) => {
    if (item.status === 'error') return 'progress-bar-error';
    if (item.status === 'skipped') return 'progress-bar-skipped';
    if (item.progress === 100) return 'progress-bar-completed';
    return 'progress-bar-downloading';
};

const SpeedDisplay: React.FC<{ speed?: number }> = ({ speed }) => {
    if (!speed || speed === 0) return null;
    return <span className="status-item-speed">{speed.toFixed(2)} MB/s</span>;
};

const Track: React.FC<ItemProps> = memo(({ item }) => {
    return (
        <div className={`status-item ${item.status === 'skipped' ? 'skipped' : ''}`}>
            <div className="status-item-header">
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
                <SpeedDisplay speed={item.speed} />
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
});
Track.displayName = 'Track';

const ParentProgressItem: React.FC<ItemProps> = memo(({ item }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const toggleCollapse = () => setIsCollapsed(prev => !prev);
    const isParent = item.items && Object.keys(item.items).length > 0;

    return (
        <div className={`status-item ${item.status === 'skipped' ? 'skipped' : ''}`}>
            <div className="status-item-header" onClick={toggleCollapse}>
                {isParent && <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>}
                <span className="status-item-title">{item.title}</span>
                <span className="status-item-message">{item.message}</span>
                <SpeedDisplay speed={item.speed} />
            </div>
            <div className="status-item-body">
                <div className="progress-bar-wrapper">
                    <div className="progress-bar-container">
                        <div className={`progress-bar ${getProgressColor(item)}`} style={{ width: `${item.progress}%` }}></div>
                    </div>
                </div>
            </div>
            {isParent && !isCollapsed && (
                <div className="status-item-children">
                    {Object.values(item.items!).map(childItem => {
                        if (childItem.type === 'track') {
                            return <Track key={childItem.id} item={childItem} />;
                        }
                        return <ParentProgressItem key={childItem.id} item={childItem} />;
                    })}
                </div>
            )}
        </div>
    );
});
ParentProgressItem.displayName = 'ParentProgressItem';


interface ProgressProps {
    items: { [id: string]: ProgressItem };
}

const Progress: React.FC<ProgressProps> = ({ items }) => {
    return (
        <div className="status">
            {Object.values(items).map((item) => {
                if (item.type === 'track') {
                    return <Track key={item.id} item={item} />;
                }
                return <ParentProgressItem key={item.id} item={item} />;
            })}
        </div>
    );
};

export const updateProgressState = (
    p: { [id: string]: ProgressItem },
    trackId: string,
    updater: (trackProgress: ProgressItem) => ProgressItem,
    parentId?: string,
    grandparentId?: string
): { [id: string]: ProgressItem } => {
    if (grandparentId && parentId) {
        // Artist -> Album -> Track
        const grandparent = p[grandparentId];
        if (!grandparent || !grandparent.items) return p;
        const parent = grandparent.items[parentId];
        if (!parent || !parent.items) return p;
        const track = parent.items[trackId];
        if (!track) return p;

        const updatedTrack = updater(track);
        const updatedParentItems = { ...parent.items, [trackId]: updatedTrack };
        
        const completedParentItems = Object.values(updatedParentItems).filter(item => item.progress === 100).length;
        const parentTotalProgress = Object.values(updatedParentItems).reduce((acc, item) => acc + item.progress, 0);
        const parentProgress = Math.round(parentTotalProgress / (Object.keys(updatedParentItems).length * 100) * 100);
        const parentDownloadedBytes = Object.values(updatedParentItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
        const parentTimeElapsed = Date.now() - (parent.startTime || 0);
        const parentSpeed = parentTimeElapsed > 0 ? (parentDownloadedBytes / parentTimeElapsed) * 1000 / (1024 * 1024) : 0;
        const parentMessage = parentProgress === 100 ? 'Download complete' : `Downloaded ${completedParentItems} of ${Object.keys(updatedParentItems).length} tracks`;

        const updatedParent = { ...parent, progress: parentProgress, items: updatedParentItems, message: parentMessage, speed: parentSpeed, downloadedBytes: parentDownloadedBytes };
        const updatedGrandparentItems = { ...grandparent.items, [parentId]: updatedParent };

        const completedGrandparentItems = Object.values(updatedGrandparentItems).filter(item => item.progress === 100).length;
        const grandparentTotalProgress = Object.values(updatedGrandparentItems).reduce((acc, item) => acc + item.progress, 0);
        const grandparentProgress = Math.round(grandparentTotalProgress / (Object.keys(updatedGrandparentItems).length * 100) * 100);
        const grandparentDownloadedBytes = Object.values(updatedGrandparentItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
        const grandparentTimeElapsed = Date.now() - (grandparent.startTime || 0);
        const grandparentSpeed = grandparentTimeElapsed > 0 ? (grandparentDownloadedBytes / grandparentTimeElapsed) * 1000 / (1024 * 1024) : 0;
        const grandparentMessage = grandparentProgress === 100 ? 'Download complete' : `Downloaded ${completedGrandparentItems} of ${Object.keys(updatedGrandparentItems).length} albums`;

        return { ...p, [grandparentId]: { ...grandparent, progress: grandparentProgress, items: updatedGrandparentItems, message: grandparentMessage, speed: grandparentSpeed, downloadedBytes: grandparentDownloadedBytes } };

    } else if (parentId) {
        // Album/Playlist -> Track
        const parent = p[parentId];
        if (!parent || !parent.items) return p;
        const track = parent.items[trackId];
        if (!track) return p;
        const updatedTrack = updater(track);
        const updatedItems = { ...parent.items, [trackId]: updatedTrack };

        const completedItems = Object.values(updatedItems).filter(item => item.progress === 100).length;
        const totalProgress = Object.values(updatedItems).reduce((acc, item) => acc + item.progress, 0);
        const parentProgress = Math.round(totalProgress / (Object.keys(updatedItems).length * 100) * 100);
        const parentDownloadedBytes = Object.values(updatedItems).reduce((acc, item) => acc + (item.downloadedBytes || 0), 0);
        const parentTimeElapsed = Date.now() - (parent.startTime || 0);
        const parentSpeed = parentTimeElapsed > 0 ? (parentDownloadedBytes / parentTimeElapsed) * 1000 / (1024 * 1024) : 0;
        const parentMessage = parentProgress === 100 ? 'Download complete' : `Downloaded ${completedItems} of ${Object.keys(updatedItems).length} tracks`;

        return { ...p, [parentId]: { ...parent, progress: parentProgress, items: updatedItems, message: parentMessage, speed: parentSpeed, downloadedBytes: parentDownloadedBytes } };
    } else {
        // Standalone Track
        const track = p[trackId];
        if (!track) return p;
        return { ...p, [trackId]: updater(track) };
    }
};

export default memo(Progress);
