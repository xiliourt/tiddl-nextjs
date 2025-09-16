'use client';

import { useState, useEffect } from 'react';
import { getDeviceAuth, getToken, refreshToken, AuthResponse } from '@/lib/auth';
import Settings from '@/components/Settings';
import { Config } from '@/types/config';
import CogIcon from '@/components/CogIcon';
import { tidalResourceFromString } from '@/lib/utils';
import { ProgressItem, Track, Album, Playlist, Artist } from '@/components/Progress';
import { downloadAlbum, downloadPlaylist, downloadArtist, downloadTrack, downloadFile } from '@/lib/download';

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
            album: '{number:02d}. {artist} - {title}',
            playlist: '{playlist_number:02d}. {artist} - {title}',
        },
        download: {
            quality: 'HIGH',
            singles_filter: 'include',
            download_video: false,
        },
    });
    const [progress, setProgress] = useState<{ [id: string]: ProgressItem }>({});

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
    }, []);

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
            } catch (error) {
                // Ignore pending errors
            }
        }, deviceAuth.interval * 1000);

        setTimeout(() => {
            clearInterval(poll);
        }, deviceAuth.expiresIn * 1000);
    };

    const handleLogout = () => {
        setAuth(null);
        localStorage.removeItem('auth');
    };

    const handleRefreshToken = async (refreshTokenValue: string | undefined) => {
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
    };

    const handleConfigChange = (newConfig: Config) => {
        setConfig(newConfig);
        localStorage.setItem('config', JSON.stringify(newConfig));
    };

    const handleDownload = () => {
        const resource = tidalResourceFromString(url);
        if (!resource || !auth) {
            alert('Invalid Tidal URL or not logged in');
            return;
        }

        switch (resource.type) {
            case 'track':
                downloadTrack(resource.id, auth, config, setProgress);
                break;
            case 'video':
                // downloadVideo(resource.id);
                break;
            case 'album':
                downloadAlbum(resource.id, auth, config, setProgress);
                break;
            case 'playlist':
                downloadPlaylist(resource.id, auth, config, setProgress);
                break;
            case 'artist':
                downloadArtist(resource.id, auth, config, setProgress);
                break;
        }
    };

    return (
        <div className="container">
            <div className="settings-icon" onClick={() => setIsSettingsOpen(true)}>
                <CogIcon />
            </div>
            <h1>Tiddl-NextJS</h1>
            {auth ? (
                <>
                    <div className="url-bar">
                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a Tidal URL" />
                        <button onClick={handleDownload}>Download</button>
                    </div>
                    <div className="status">
                        {Object.values(progress).map((p) => {
                            if (p.type === 'artist') {
                                return <Artist key={`${p.type}-${p.id}`} item={p} onDownload={downloadFile} />;
                            }
                            if (p.type === 'album') {
                                return <Album key={`${p.type}-${p.id}`} item={p} onDownload={downloadFile} />;
                            }
                            if (p.type === 'playlist') {
                                return <Playlist key={`${p.type}-${p.id}`} item={p} onDownload={downloadFile} />;
                            }
                            return <Track key={`${p.type}-${p.id}`} item={p} onDownload={() => downloadFile(p)} />;
                        })}
                    </div>
                    <button onClick={handleLogout}>Logout</button>
                    <button onClick={() => handleRefreshToken(auth.refresh_token!)}>Refresh</button>
                </>
            ) : (
                <>
                    <div className="login-container">
                        <button onClick={handleLogin}>Login</button>
                        {showLogin && (
                            <div className="login-block">
                                <h2>Login with Tidal</h2>
                                <p>Open the following URL in your browser:</p>
                                <a href={`https://${loginUrl}`} target="_blank" rel="noopener noreferrer">{`https://${loginUrl}`}</a>
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