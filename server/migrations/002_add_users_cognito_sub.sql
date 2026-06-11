ALTER TABLE users
  ADD COLUMN cognito_sub VARCHAR(255);

CREATE UNIQUE INDEX users_cognito_sub_unique
  ON users (cognito_sub)
  WHERE cognito_sub IS NOT NULL;
