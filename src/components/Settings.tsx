'use client';

import { Config } from '@/types/config';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    config: Config;
    onConfigChange: (newConfig: Config) => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, config, onConfigChange }) => {
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

    const handleDownloadChange = (key: keyof Config['download'], value: any) => {
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
            <div className="settings-content">
                <h2>Settings</h2>
                <div className="settings-section">
                    <h3>File Name Format</h3>
                    <label>Track:</label>
                    <input type="text" name="track" value={config.template.track} onChange={handleTemplateChange} />
                    <label>Video:</label>
                    <input type="text" name="video" value={config.template.video} onChange={handleTemplateChange} />
                    <label>Album:</label>
                    <input type="text" name="album" value={config.template.album} onChange={handleTemplateChange} />
                    <label>Playlist:</label>
                    <input type="text" name="playlist" value={config.template.playlist} onChange={handleTemplateChange} />
                </div>
                <div className="settings-section">
                    <h3>Download Options</h3>
                    <label>Quality:</label>
                    <div className="radio-buttons">
                        <button onClick={() => handleDownloadChange('quality', 'LOW')} className={config.download.quality === 'LOW' ? 'active' : ''}>Low</button>
                        <button onClick={() => handleDownloadChange('quality', 'HIGH')} className={config.download.quality === 'HIGH' ? 'active' : ''}>Medium</button>
                        <button onClick={() => handleDownloadChange('quality', 'LOSSLESS')} className={config.download.quality === 'LOSSLESS' ? 'active' : ''}>High</button>
                        <button onClick={() => handleDownloadChange('quality', 'HI_RES_LOSSLESS')} className={config.download.quality === 'HI_RES_LOSSLESS' ? 'active' : ''}>Master</button>
                    </div>
                    <label>Include Singles:</label>
                    <div className="radio-buttons">
                        <button onClick={() => handleDownloadChange('singles_filter', 'none')} className={config.download.singles_filter === 'none' ? 'active' : ''}>None</button>
                        <button onClick={() => handleDownloadChange('singles_filter', 'only')} className={config.download.singles_filter === 'only' ? 'active' : ''}>Only</button>
                        <button onClick={() => handleDownloadChange('singles_filter', 'include')} className={config.download.singles_filter === 'include' ? 'active' : ''}>Include</button>
                    </div>
                    <label>Download Videos:</label>
                    <div className="radio-buttons">
                        <button onClick={() => handleDownloadChange('download_video', true)} className={config.download.download_video ? 'active' : ''}>True</button>
                        <button onClick={() => handleDownloadChange('download_video', false)} className={!config.download.download_video ? 'active' : ''}>False</button>
                    </div>
                </div>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default Settings;
