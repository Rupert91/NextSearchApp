import { useMemo } from 'react';
import useCsrfToken from 'src/app/core/hooks/use-csrf-token';

function useCsrfTokenHeader() {
  const csrfToken = useCsrfToken();

  return useMemo(
    () => ({
      'X-CSRF-Token': csrfToken,
    }),
    [csrfToken]
  );
}

export default useCsrfTokenHeader;
