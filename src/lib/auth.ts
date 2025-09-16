'use client';

import axios from 'axios';

const AUTH_URL = 'https://auth.tidal.com/v1/oauth2';
const CLIENT_ID = 'zU4XHVVkc2tDPo4t';
const CLIENT_SECRET = 'VJKhDFqJPqvsPVNBV6ukXTJmwlvbttP7wlMlrc72se4=';

export interface AuthDeviceResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
}

export interface AuthResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    user: {
        userId: number;
        email: string;
        countryCode: string;
        fullName: string;
        firstName: string;
        lastName: string;
        nickname: string;
        username: string;
        address: string;
        created: number;
        updated: number;
        facebookUid: number;
        appleUid: string;
    };
    user_id: number;
}

export async function getDeviceAuth(): Promise<AuthDeviceResponse> {
    const response = await axios.post(
        `${AUTH_URL}/device_authorization`,
        new URLSearchParams({
            client_id: CLIENT_ID,
            scope: 'r_usr+w_usr+w_sub',
        })
    );
    return response.data;
}

export async function getToken(deviceCode: string): Promise<AuthResponse> {
    const response = await axios.post(
        `${AUTH_URL}/token`,
        new URLSearchParams({
            client_id: CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            scope: 'r_usr+w_usr+w_sub',
        }),
        {
            auth: {
                username: CLIENT_ID,
                password: CLIENT_SECRET,
            },
        }
    );
    return response.data;
}

export async function refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await axios.post(
        `${AUTH_URL}/token`,
        new URLSearchParams({
            client_id: CLIENT_ID,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'r_usr+w_usr+w_sub',
        }),
        {
            auth: {
                username: CLIENT_ID,
                password: CLIENT_SECRET,
            },
        }
    );
    return response.data;
}
