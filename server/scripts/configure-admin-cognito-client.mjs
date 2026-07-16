import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  DeleteUserPoolClientCommand,
  ListUserPoolClientsCommand,
} from '@aws-sdk/client-cognito-identity-provider';

Error.stackTraceLimit = 0;

if (process.env.CONFIRM_CREATE_ADMIN_COGNITO_CLIENT !== 'true') {
  throw new Error(
    'Set CONFIRM_CREATE_ADMIN_COGNITO_CLIENT=true to create the dedicated Cognito app client',
  );
}

const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
const region = process.env.AWS_REGION;
const clientName = process.env.ADMIN_COGNITO_CLIENT_NAME || 'trustbite-admin-web';
if (!userPoolId || !region) {
  throw new Error('AWS_COGNITO_USER_POOL_ID and AWS_REGION are required');
}

const cognito = new CognitoIdentityProviderClient({ region });
const sendSafely = async (command) => {
  try {
    return await cognito.send(command);
  } catch (err) {
    if (err?.name === 'AccessDeniedException') {
      throw new Error(
        'AWS credentials lack permission to list or create Cognito user-pool clients',
      );
    }
    throw new Error(`Cognito app-client configuration failed: ${err?.name || 'UnknownError'}`);
  }
};

let nextToken;
let existing;
do {
  const listed = await sendSafely(new ListUserPoolClientsCommand({
    UserPoolId: userPoolId,
    MaxResults: 60,
    NextToken: nextToken,
  }));
  existing = listed.UserPoolClients?.find((client) => client.ClientName === clientName);
  nextToken = listed.NextToken;
} while (!existing && nextToken);
if (existing) {
  throw new Error(
    `Cognito app client "${clientName}" already exists. Refusing to create a duplicate or expose an existing secret.`,
  );
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(scriptDirectory, '../.env');
const current = await fs.readFile(envPath, 'utf8');
const envHandle = await fs.open(envPath, 'r+');
await envHandle.close();
const setValue = (source, name, value) => {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'mu');
  return pattern.test(source)
    ? source.replace(pattern, line)
    : `${source.trimEnd()}\n${line}\n`;
};

let appClient;
let temporaryEnvPath;
try {
  const created = await sendSafely(new CreateUserPoolClientCommand({
    UserPoolId: userPoolId,
    ClientName: clientName,
    GenerateSecret: true,
    ExplicitAuthFlows: [
      'ALLOW_USER_PASSWORD_AUTH',
    ],
    PreventUserExistenceErrors: 'ENABLED',
    EnableTokenRevocation: true,
    AccessTokenValidity: 15,
    IdTokenValidity: 15,
    RefreshTokenValidity: 1,
    TokenValidityUnits: {
      AccessToken: 'minutes',
      IdToken: 'minutes',
      RefreshToken: 'days',
    },
    SupportedIdentityProviders: ['COGNITO'],
  }));

  appClient = created.UserPoolClient;
  if (!appClient?.ClientId || !appClient.ClientSecret) {
    throw new Error('Cognito did not return the new confidential app-client credentials');
  }

  let updated = setValue(current, 'AWS_COGNITO_ADMIN_WEB_CLIENT_ID', appClient.ClientId);
  updated = setValue(updated, 'AWS_COGNITO_ADMIN_WEB_CLIENT_SECRET', appClient.ClientSecret);
  temporaryEnvPath = `${envPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryEnvPath, updated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await fs.rename(temporaryEnvPath, envPath);
} catch (err) {
  if (temporaryEnvPath) {
    await fs.unlink(temporaryEnvPath).catch(() => {});
  }
  if (appClient?.ClientId) {
    try {
      await cognito.send(new DeleteUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientId: appClient.ClientId,
      }));
    } catch {
      throw new Error(
        `Credential persistence failed and Cognito app client "${clientName}" could not be rolled back; delete it manually before retrying.`,
      );
    }
  }
  throw err;
}

console.log(`Created dedicated Cognito app client "${clientName}" and stored its credentials in server/.env.`);
