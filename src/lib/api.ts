import axios from 'axios';
import { AuthResponse } from '@/types/auth';
import { TidalApiItem, ResourceType } from '@/types/tidal';

const baseUrl = "https://api.tidal.com/v1"

const apiCall = (endpoint: string, params: Record<string, any>) => { 
    await axios.get(`${baseUrl}/${endPoint}`, {
          headers: { Authorization: `Bearer ${auth.access_token}` },
          params: { countryCode: auth.user.countryCode },
    });
}

export const fetchItemInfo = ({id: string, type: string}: ResourceType): FetchInfoFn => {
    apiCall(`https://api.tidal.com/v1/${type}/${id}`), {
        headers: { Authorization: `Bearer ${auth.access_token}` },
        params: { countryCode: auth.user.countryCode }
    });
}

// Will slowly move API functions here for reusability
