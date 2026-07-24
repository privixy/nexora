const APP_NAME = 'Nexora';

export const formatWindowTitle = (detail?: string): string =>
  detail ? `${APP_NAME} - ${detail}` : APP_NAME;
