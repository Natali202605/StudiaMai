window.STUDIA_MAI_API = window.STUDIA_MAI_API || (
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && location.port === '3000'
    ? ''
    : (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : ''
);
