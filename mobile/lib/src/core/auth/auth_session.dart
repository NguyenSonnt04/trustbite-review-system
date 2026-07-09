class AuthSession {
  const AuthSession({
    this.accessToken,
    this.trustedLocalUserId,
    this.trustedLocalSubject,
    this.trustedLocalPhoneNumber,
  });

  const AuthSession.cognito({required String accessToken})
      : this(accessToken: accessToken);

  const AuthSession.trustedLocal({
    required String userId,
    required String subject,
    String? phoneNumber,
  }) : this(
          trustedLocalUserId: userId,
          trustedLocalSubject: subject,
          trustedLocalPhoneNumber: phoneNumber,
        );

  final String? accessToken;
  final String? trustedLocalUserId;
  final String? trustedLocalSubject;
  final String? trustedLocalPhoneNumber;
}
