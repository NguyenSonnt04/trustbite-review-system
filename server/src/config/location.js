const endpoint = process.env.AWS_LOCATION_ENDPOINT_URL
  || process.env.AWS_ENDPOINT_URL
  || process.env.LOCALSTACK_ENDPOINT_URL;

const credentials = process.env.AWS_LOCATION_ACCESS_KEY_ID
  && process.env.AWS_LOCATION_SECRET_ACCESS_KEY
  ? {
    accessKeyId: process.env.AWS_LOCATION_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_LOCATION_SECRET_ACCESS_KEY,
    ...(process.env.AWS_LOCATION_SESSION_TOKEN
      ? { sessionToken: process.env.AWS_LOCATION_SESSION_TOKEN }
      : {}),
  }
  : undefined;

// Amazon Location resource identifiers and the browser-safe map key are loaded
// from the environment. The API key is exposed only as configuration metadata;
// backend place/route requests prefer dedicated credentials and otherwise use the SDK credential chain.
export default Object.freeze({
  region: process.env.AWS_REGION,
  endpoint,
  credentials,
  mapName: process.env.AWS_LOCATION_MAP_NAME,
  placeIndexName: process.env.AWS_LOCATION_PLACE_INDEX_NAME,
  routeCalculatorName: process.env.AWS_LOCATION_ROUTE_CALCULATOR_NAME,
  mapApiKey: process.env.AWS_LOCATION_MAP_API_KEY,
});
