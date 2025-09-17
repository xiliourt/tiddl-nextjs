'use client';

import { Config } from '@/types/config';
import { useEffect, useRef } from 'react';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    config: Config;
    onConfigChange: (newConfig: Config) => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, config, onConfigChange }) => {
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onConfigChange({
            ...config,
            template: {
                ...config.template,
                [e.target.name]: e.target.value,
            },
        });
    };

    const handleDownloadChange = (key: keyof Config['download'], value: string | boolean | number) => {
        onConfigChange({
            ...config,
            download: {
                ...config.download,
                [key]: value,
            },
        });
    };

    return (
        <div className="settings-popup">
            <div className="settings-content" ref={settingsRef}>
                <h2>Settings</h2>
                <div className="settings-section">
                    <h3>File Name Format</h3>
                    <div className="settings-item">
                        <label>Track:</label>
                        <input type="text" name="track" value={config.template.track} onChange={handleTemplateChange} />
                    </div>    
                    <div className="settings-item">
                        <label>Video:</label>
                        <input type="text" name="video" value={config.template.video} onChange={handleTemplateChange} />
                    </div>
                    <div className="settings-item">
                        <label>Album:</label>
                        <input type="text" name="album" value={config.template.album} onChange={handleTemplateChange} />
                    </div>
                    <div className="settings-item">
                        <label>Playlist:</label>
                        <input type="text" name="playlist" value={config.template.playlist} onChange={handleTemplateChange} />
                    </div>
               </div>
                <div className="settings-section">
                    <h3>Download Options</h3>
                    <div className="settings-item">
                        <label className="settings-item">Quality:</label>
                        <div className="radio-buttons">
                            <button onClick={() => handleDownloadChange('quality', 'LOW')} className={config.download.quality === 'LOW' ? 'active' : ''}>Low</button>
                            <button onClick={() => handleDownloadChange('quality', 'HIGH')} className={config.download.quality === 'HIGH' ? 'active' : ''}>Medium</button>
                            <button onClick={() => handleDownloadChange('quality', 'LOSSLESS')} className={config.download.quality === 'LOSSLESS' ? 'active' : ''}>High</button>
                            <button onClick={() => handleDownloadChange('quality', 'HI_RES_LOSSLESS')} className={config.download.quality === 'HI_RES_LOSSLESS' ? 'active' : ''}>Master</button>
                        </div>
                    </div>
                    <div className="settings-item">
                        <label className="settings-item">Include Singles:</label>
                        <div className="radio-buttons">
                            <button onClick={() => handleDownloadChange('singles_filter', 'none')} className={config.download.singles_filter === 'none' ? 'active' : ''}>None</button>
                            <button onClick={() => handleDownloadChange('singles_filter', 'only')} className={config.download.singles_filter === 'only' ? 'active' : ''}>Only</button>
                            <button onClick={() => handleDownloadChange('singles_filter', 'include')} className={config.download.singles_filter === 'include' ? 'active' : ''}>Include</button>
                        </div>
                    </div>
                    <div className="settings-item">
                        <label className="settings-item">Download Videos:</label>
                        <div className="radio-buttons">
                            <button onClick={() => handleDownloadChange('download_video', true)} className={config.download.download_video ? 'active' : ''}>True</button>
                            <button onClick={() => handleDownloadChange('download_video', false)} className={!config.download.download_video ? 'active' : ''}>False</button>
                        </div>
                    </div>
                    <div className="settings-item">
                        <label>Threads:</label>
                        <input type="number" name="threads" value={config.download.threads} onChange={(e) => handleDownloadChange('threads', parseInt(e.target.value, 10))} />
                    </div>
                </div>
                <div className="settings-submit-section">
                    <button className="button settings-button" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default Settings;