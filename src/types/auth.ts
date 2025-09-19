export type AuthDeviceResponse = {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
}

export type AuthResponse = {
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
