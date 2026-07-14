import { isIP } from 'node:net';
import { createHttpError } from '../utils/httpErrors.js';
import { pool } from '../config/db.js';
import appConfig from '../config/app.js';
import { adminWebAuthService } from '../services/adminWebAuth.js';

const createCognitoFlowNotImplementedError = (message) =>
  createHttpError(501, 'COGNITO_FLOW_NOT_IMPLEMENTED', message);

export const sendOtp = async (req, res, next) => {
  try {
    const message = 'OTP delivery is owned by Cognito and is not implemented as a backend-issued OTP flow';
    throw createCognitoFlowNotImplementedError(message);
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const message = 'OTP verification/token issuance is owned by Cognito and is not implemented as a backend-issued JWT flow';
    throw createCognitoFlowNotImplementedError(message);
  } catch (err) {
    next(err);
  }
};

const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') {
    throw createHttpError(422, 'VALIDATION_ERROR', 'phoneNumber must be a string');
  }

  const phoneNumber = value.trim();
  if (!/^\+?[0-9]{6,20}$/.test(phoneNumber)) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'phoneNumber must contain 6 to 20 digits, optionally prefixed with +');
  }

  return phoneNumber;
};

const normalizeDisplayName = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const displayName = String(value).trim();
  if (displayName.length > 120) {
    throw createHttpError(422, 'VALIDATION_ERROR', 'displayName must be at most 120 characters');
  }

  return displayName;
};

const defaultLocalDisplayName = (phoneNumber) => `Local ${phoneNumber.slice(-4)}`;

const assertLocalDevelopmentSignupEnabled = () => {
  if (appConfig.env === 'production' || !appConfig.trustedAuthHeaders) {
    throw createHttpError(
      403,
      'LOCAL_AUTH_DISABLED',
      'Local development signup requires TRUSTBITE_TRUSTED_AUTH_HEADERS=true outside production'
    );
  }
};

export const createLocalDevelopmentUser = async (req, res, next) => {
  try {
    assertLocalDevelopmentSignupEnabled();

    const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber);
    const displayName = normalizeDisplayName(req.body?.displayName);

    const result = await pool.query(
      `INSERT INTO users (phone_number, display_name)
       VALUES ($1, COALESCE($2, $3))
       ON CONFLICT (phone_number) DO UPDATE
       SET display_name = COALESCE($2, users.display_name)
       RETURNING id, phone_number, display_name, status, created_at, updated_at, (xmax = 0) AS inserted`,
      [phoneNumber, displayName, defaultLocalDisplayName(phoneNumber)]
    );

    const user = result.rows[0];
    res.status(user.inserted ? 201 : 200).json({
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        displayName: user.display_name,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      trustedLocal: {
        userId: user.id,
        subject: `local:${user.id}`,
        phoneNumber: user.phone_number,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getAdminSessionToken = (req) => req.header('x-trustbite-admin-session') || '';
const getAdminLoginAddress = (req) => {
  const forwardedAddress = req.header('x-trustbite-client-address')?.trim() || '';
  return isIP(forwardedAddress) > 0 ? forwardedAddress : req.ip;
};

export const createAdminWebSession = async (req, res, next) => {
  try {
    const result = await adminWebAuthService.login({
      email: req.body?.email,
      password: req.body?.password,
      ipAddress: getAdminLoginAddress(req),
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const getAdminWebSession = async (req, res, next) => {
  try {
    const result = await adminWebAuthService.validate(getAdminSessionToken(req));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteAdminWebSession = async (req, res, next) => {
  try {
    await adminWebAuthService.logout(getAdminSessionToken(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
