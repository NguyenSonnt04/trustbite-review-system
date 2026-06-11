import { createHttpError } from '../utils/httpErrors.js';

const createCognitoFlowNotImplementedError = (message) =>
  createHttpError(501, 'COGNITO_FLOW_NOT_IMPLEMENTED', message);

export const sendOtp = () => {
  const message = 'OTP delivery is owned by Cognito and is not implemented as a backend-issued OTP flow';
  throw createCognitoFlowNotImplementedError(message);
};

export const verifyOtp = () => {
  const message = 'OTP verification/token issuance is owned by Cognito and is not implemented as a backend-issued JWT flow';
  throw createCognitoFlowNotImplementedError(message);
};
