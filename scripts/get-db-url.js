const fs = require('fs');
const path = require('path');

function getDatabaseUrl(env) {
  try {
    const credentialsPath = path.resolve(__dirname, '../.db-credentials.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    if (!credentials[env]) {
      throw new Error(`No credentials found for environment: ${env}`);
    }

    const { host, port, database, schema, username, password } =
      credentials[env];
    let url = `postgresql://${username}:${password}@${host}:${port}/${database}`;

    if (schema) {
      url += `?schema=${schema}`;
    }

    if (env === 'production') {
      url += url.includes('?') ? '&' : '?';
      url +=
        'sslmode=disable&connection_limit=5&pool_timeout=10&connect_timeout=5';
    }

    return url;
  } catch (error) {
    console.error(`Error getting database URL: ${error.message}`);
    process.exit(1);
  }
}

const env = process.argv[2] || 'development';
console.log(getDatabaseUrl(env));
