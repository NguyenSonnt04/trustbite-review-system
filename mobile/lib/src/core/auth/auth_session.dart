class AuthSession {
  const AuthSession({
    this.trustedLocalUserId,
    this.trustedLocalSubject,
    this.trustedLocalPhoneNumber,
  });

  const AuthSession.trustedLocal({
    required String userId,
    required String subject,
    String? phoneNumber,
  }) : this(
         trustedLocalUserId: userId,
         trustedLocalSubject: subject,
         trustedLocalPhoneNumber: phoneNumber,
       );

  final String? trustedLocalUserId;
  final String? trustedLocalSubject;
  final String? trustedLocalPhoneNumber;
}
