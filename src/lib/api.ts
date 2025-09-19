import axios from 'axios';
import { AuthResponse } from '@/types/auth';
import { TidalApiItem, ResourceType } from '@/types/tidal';

const baseUrl = "https://api.tidal.com/v1/"

const apiCall = (endpoint: string, params?: Record<string, any>) => { 
    await axios.get(`${baseUrl}/${endPoint}`, {
          headers: { Authorization: `Bearer ${auth.access_token}` },
          params: params? params : { countryCode: auth.user.countryCode },
    });
}

export const fetchItemInfo: FetchItemInfo = ({id, type}, auth): ApiCallFn => {
    apiCall(`${type}/${id}`);
}

export const fetchTidalItems: FetchTidalItems = ({id, type}, auth, offset) => {
    apiCall(`${type}/${id}/items`, { params: { countryCode: auth.user.countryCode, limit: 100, offset }});
}

// Will slowly move API functions here for reusability
