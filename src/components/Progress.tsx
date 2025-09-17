'use client';

import React, { useState } from 'react';
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

interface ProgressProps {
    items: { [id: string]: ProgressItem };
}

const Progress: React.FC<ProgressProps> = ({ items }) => {
    const [collapsed, setCollapsed] = useState<{ [id: string]: boolean }>({});

    const toggleCollapse = (id: string) => {
        setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const renderItem = (item: ProgressItem) => {
        const isParent = item.items && Object.keys(item.items).length > 0;
        const isCollapsed = collapsed[item.id] ?? false;

        const getProgressColor = () => {
            if (item.status === 'error') return 'progress-bar-error';
            if (item.progress === 100) return 'progress-bar-completed';
            return 'progress-bar-downloading';
        };

        return (
            <div key={item.id} className="status-item">
                <div className="status-item-header" onClick={() => isParent && toggleCollapse(item.id)}>
                    {isParent && (
                        <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                    )}
                    <span className="status-item-title">{item.title}</span>
                    <span className="status-item-message">{item.message}</span>
                </div>
                <div className="status-item-body">
                    <div className="progress-bar-wrapper">
                        <div className="progress-bar-container">
                            <div className={`progress-bar ${getProgressColor()}`} style={{ width: `${item.progress}%` }}></div>
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
                        {Object.values(item.items!).map(renderItem)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="status">
            {Object.values(items).map(renderItem)}
        </div>
    );
};

export default Progress;
