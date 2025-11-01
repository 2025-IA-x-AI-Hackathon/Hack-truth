import { useMemo } from 'react';

export const useQueryParam = (key) => {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }, [key]);
};
