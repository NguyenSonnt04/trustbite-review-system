import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const loadLocationConfig = async (caseName) => {
  vi.resetModules();
  const imports = {
    resources: () => import('../../../src/config/location.js?resources'),
    endpoint: () => import('../../../src/config/location.js?endpoint'),
  };
  return (await imports[caseName]()).default;
};

describe('AWS Location config', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('reads Location resource names and the map API key from environment', async () => {
    process.env.AWS_REGION = 'ap-southeast-1';
    process.env.AWS_LOCATION_MAP_NAME = 'map-from-env';
    process.env.AWS_LOCATION_PLACE_INDEX_NAME = 'index-from-env';
    process.env.AWS_LOCATION_ROUTE_CALCULATOR_NAME = 'route-from-env';
    process.env.AWS_LOCATION_MAP_API_KEY = 'key-from-env';
    process.env.AWS_LOCATION_ACCESS_KEY_ID = 'location-access-key';
    process.env.AWS_LOCATION_SECRET_ACCESS_KEY = 'location-secret-key';
    process.env.AWS_LOCATION_SESSION_TOKEN = 'location-session-token';

    const config = await loadLocationConfig('resources');

    expect(config).toMatchObject({
      region: 'ap-southeast-1',
      mapName: 'map-from-env',
      placeIndexName: 'index-from-env',
      routeCalculatorName: 'route-from-env',
      mapApiKey: 'key-from-env',
      credentials: {
        accessKeyId: 'location-access-key',
        secretAccessKey: 'location-secret-key',
        sessionToken: 'location-session-token',
      },
    });
  });

  it('does not create partial Location credentials', async () => {
    process.env.AWS_LOCATION_ACCESS_KEY_ID = 'location-access-key';
    delete process.env.AWS_LOCATION_SECRET_ACCESS_KEY;

    const config = await loadLocationConfig('resources');

    expect(config.credentials).toBeUndefined();
  });

  it('prefers a Location endpoint and otherwise falls back to the AWS endpoint', async () => {
    process.env.AWS_LOCATION_ENDPOINT_URL = 'http://location.test:4566';
    process.env.AWS_ENDPOINT_URL = 'http://aws.test:4566';
    process.env.LOCALSTACK_ENDPOINT_URL = 'http://localstack.test:4566';

    const config = await loadLocationConfig('endpoint');

    expect(config.endpoint).toBe('http://location.test:4566');
  });
});
