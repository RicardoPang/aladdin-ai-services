export interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  cors: {
    origin: string;
  };
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV || 'development';

  return {
    env,
    port: parseInt(process.env.PORT || '8092', 10),
    database: {
      url: process.env.DATABASE_URL || '',
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:8092',
    },
  };
};
