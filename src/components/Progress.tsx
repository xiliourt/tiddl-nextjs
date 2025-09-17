'use client';

import React, { useState, memo } from 'react';
import { ProgressItem } from '@/types/download';

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

export default memo(Progress);