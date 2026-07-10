import 'package:trustbite_mobile/src/core/auth/auth_session.dart';

abstract class AuthSessionStore {
  Future<AuthSession?> read();

  Future<void> write(AuthSession session);

  Future<void> clear();
}

class InMemoryAuthSessionStore implements AuthSessionStore {
  InMemoryAuthSessionStore([this._session]);

  AuthSession? _session;

  @override
  Future<AuthSession?> read() async => _session;

  @override
  Future<void> write(AuthSession session) async {
    _session = session;
  }

  @override
  Future<void> clear() async {
    _session = null;
  }
}
