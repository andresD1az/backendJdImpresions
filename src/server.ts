import app from './app';
import { config } from './config';

// Azure asigna el puerto automáticamente vía process.env.PORT
const PORT = parseInt(process.env.PORT || config.port, 10);

async function startServer() {
  try {
    // Validate required environment variables
    if (!config.azureStorageConnectionString) {
      console.error('ERROR: AZURE_STORAGE_CONNECTION_STRING is not defined');
      process.exit(1);
    }

    if (!config.jwtSecret || config.jwtSecret === 'default_jwt_secret') {
      console.warn('WARNING: Using default JWT secret. Please set JWT_SECRET in production.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📦 Environment: ${config.nodeEnv}`);
      console.log(`☁️  Azure Storage Container: ${config.azureStorageContainerName}`);
      console.log(`🔐 CORS Origin: ${config.corsOrigin}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
