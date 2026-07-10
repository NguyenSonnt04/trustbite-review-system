abstract interface class CognitoSessionProvider {
  Future<void> initialize();

  Future<bool> isSignedIn();

  Future<String?> getAccessToken();

  Future<void> signOut();
}
