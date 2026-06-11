export const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json(data);
};

export const sendAccepted = (res, data) => sendSuccess(res, data, 202);
