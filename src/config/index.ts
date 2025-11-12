import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.APP_PORT || '4000',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Captcha
  captchaProvider: process.env.CAPTCHA_PROVIDER || 'turnstile',
  captchaSecretKey: process.env.CAPTCHA_SECRET_KEY,
  captchaSiteKey: process.env.CAPTCHA_SITE_KEY,
  
  // Azure Storage
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  azureStorageContainerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'product-images',
};
