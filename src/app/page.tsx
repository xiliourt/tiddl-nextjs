'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDeviceAuth, getToken, refreshToken } from '@/lib/auth';
import { tidalResourceFromString } from '@/lib/utils';
import { downloadAlbum, downloadPlaylist, downloadArtist, downloadTrack } from '@/lib/download';
import { AuthResponse } from '@/types/auth';
import { ProgressItem } from '@/types/progress';
import { Config } from '@/types/config';
import { TidalResource } from '@/types/tidal';
import Settings from '@/components/Settings';
import CogIcon from '@/components/CogIcon';
import Progress from '@/components/Progress';

const App = () => {
    const [url, setUrl] = useState('');
    const [auth, setAuth] = useState<AuthResponse | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    const [loginUrl, setLoginUrl] = useState('');
    const [timer, setTimer] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [config, setConfig] = useState<Config>({
        template: {
            track: '{artist} - {title}',
            video: '{artist} - {title}',
            album: '{albim_artist}/{album}/{number:02d}. {artist} - {title}',
            playlist: '{playlist}/{playlist_number:02d}. {artist} - {title}',
        },
        download: {
            quality: 'HIGH',
            singles_filter: 'include',
            download_video: false,
            threads: 4,
        },
    });
    const [progress, setProgress] = useState<{ [id: string]: ProgressItem }>({});
    const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

    const selectDirectory = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setDirHandle(handle);
        } catch (error) {
            console.error("Failed to select directory:", error);
        }
    };

    const handleLogout = () => {
        setAuth(null);
        localStorage.removeItem('auth');
    };

    const handleRefreshToken = useCallback(async (refreshTokenValue: string | undefined) => {
        if (!refreshTokenValue) {
            console.error('No refresh token found');
            handleLogout();
            return;
        }
        try {
            const newTokenData = await refreshToken(refreshTokenValue);
            setAuth(prevAuth => {
                const newAuth = {
                    ...(prevAuth || {}),
                    ...newTokenData,
                    refresh_token: newTokenData.refresh_token || refreshTokenValue,
                };
                localStorage.setItem('auth', JSON.stringify(newAuth));
                return newAuth as AuthResponse;
            });
        } catch (error) {
            console.error('Failed to refresh token', error);
            handleLogout();
        }
    }, []);

    useEffect(() => {
        const storedAuth = localStorage.getItem('auth');
        if (storedAuth) {
            const parsedAuth = JSON.parse(storedAuth);
            setAuth(parsedAuth);
            handleRefreshToken(parsedAuth.refresh_token);
        }
        const storedConfig = localStorage.getItem('config');
        if (storedConfig) {
            setConfig(JSON.parse(storedConfig));
        }
    }, [handleRefreshToken]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showLogin && timer > 0) {
            interval = setInterval(() => {
                setTimer((prevTimer) => prevTimer - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [showLogin, timer]);

    const handleLogin = async () => {
        const deviceAuth = await getDeviceAuth();
        setLoginUrl(deviceAuth.verificationUriComplete);
        setShowLogin(true);
        setTimer(deviceAuth.expiresIn);

        const poll = setInterval(async () => {
            try {
                const token = await getToken(deviceAuth.deviceCode);
                setAuth(token);
                localStorage.setItem('auth', JSON.stringify(token));
                setShowLogin(false);
                clearInterval(poll);
            } catch {
                // Ignore pending errors
            }
        }, deviceAuth.interval * 1000);

        setTimeout(() => {
            clearInterval(poll);
        }, deviceAuth.expiresIn * 1000);
    };

    const handleConfigChange = (newConfig: Config) => {
        setConfig(newConfig);
        localStorage.setItem('config', JSON.stringify(newConfig));
    };

    const handleDownload = () => {
        if (!dirHandle) {
            alert('Please select a download folder first.');
            return;
        }

        const resource = tidalResourceFromString(url);
        if (!resource) {
            alert('Invalid link, please enter a tidal link');
            return;
        }

        if (resource.type === 'video') {
            alert('Video downloading not yet supported.');
            return;
        }

        if (!auth) {
            alert('You must be logged in to download.');
            return;
        }

        const downloadFunctions: { [key: string]: (id: string, auth: AuthResponse, config: Config, setProgress: React.Dispatch<React.SetStateAction<{ [id: string]: ProgressItem }>>, dirHandle: FileSystemDirectoryHandle) => void } = {
            track: downloadTrack,
            album: downloadAlbum,
            playlist: downloadPlaylist,
            artist: downloadArtist,
        };

        if (resource.type in downloadFunctions) {
            downloadFunctions[resource.type](resource.id, auth, config, setProgress, dirHandle);
        }
    };

    return (
        <div className="container">
            <div className="top-right-actions">
                {auth && (
                    <>
                        <button onClick={() => handleRefreshToken(auth.refresh_token!)} className="button">Refresh Token</button>
                    </>
                )}
                <div className="settings-icon" onClick={() => setIsSettingsOpen(true)}>
                    <CogIcon />
                </div>
            </div>
            <h1>Tiddl-NextJS</h1>
            {auth ? (
                <>
                    <div className="url-bar-container">
                        <div className="url-bar">
                            <button className="button icon-button" onClick={selectDirectory}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            </button>
                            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a Tidal URL" />
                            <button className="button" onClick={handleDownload}>Download</button>
                        </div>
                        {dirHandle && <p className="selected-folder">Selected Folder: <strong>{dirHandle.name}</strong></p>}
                    </div>
                    <Progress items={progress} />
                    <div className="logout-button-container">
                        <button onClick={handleLogout} className="button">Logout</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="login-container">
                        <button onClick={handleLogin} className="button">Login</button>
                        {showLogin && (
                            <div className="login-prompt">
                                <h2>Login with Tidal</h2>
                                <p>Click the button below to open the login page:</p>
                                <a href={`https://${loginUrl}`} target="_blank" rel="noopener noreferrer" className="button login-prompt-link"><strong>Click to Authenticate</strong></a>
                                <p>Expires in: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
            <Settings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                config={config}
                onConfigChange={handleConfigChange}
            />
        </div>
    );
};

export default App;
