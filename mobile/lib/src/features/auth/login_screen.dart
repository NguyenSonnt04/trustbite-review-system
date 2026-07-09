import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';

/// Login/register entry screen styled after the TrustBite discover screen.
///
/// Cognito owns credential verification and token issuance. Credentials never
/// pass through TrustBite Express.
class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    this.authService,
    this.cognitoAuthGateway,
    this.onContinueWithGoogle,
  });

  final MobileAuthService? authService;
  final CognitoAuthGateway? cognitoAuthGateway;
  final VoidCallback? onContinueWithGoogle;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const Color _brand = Color(0xFFFF5E00);
  static const Color _muted = Color(0xFF8E8E9A);

  int _activeTab = 0;
  bool _isSubmitting = false;
  CognitoAuthStep? _pendingStep;

  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmationController = TextEditingController();

  MobileAuthService get _authService =>
      widget.authService ?? appMobileAuthService;

  CognitoAuthGateway get _cognitoAuthGateway =>
      widget.cognitoAuthGateway ?? appCognitoAuthGateway;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    _confirmationController.dispose();
    super.dispose();
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _handlePrimaryAuth() async {
    setState(() => _isSubmitting = true);
    try {
      late final CognitoAuthResult result;
      final pendingStep = _pendingStep;
      if (pendingStep == CognitoAuthStep.confirmSignUp) {
        await _cognitoAuthGateway.confirmSignUp(
          identifier: _identifierController.text,
          confirmationCode: _confirmationController.text,
        );
        result = await _cognitoAuthGateway.signIn(
          identifier: _identifierController.text,
          password: _passwordController.text,
        );
      } else if (pendingStep != null) {
        result = await _cognitoAuthGateway.confirmSignIn(
          _confirmationController.text,
        );
      } else {
        result = _activeTab == 0
            ? await _cognitoAuthGateway.signIn(
                identifier: _identifierController.text,
                password: _passwordController.text,
              )
            : await _cognitoAuthGateway.signUp(
                identifier: _identifierController.text,
                password: _passwordController.text,
              );
      }

      await _handleCognitoResult(result);
    } on ApiException catch (err) {
      if (!mounted) return;
      _showMessage(err.message);
    } on ArgumentError catch (err) {
      if (!mounted) return;
      _showMessage(err.message);
    } on CognitoAuthGatewayException catch (err) {
      if (!mounted) return;
      _showMessage(err.message);
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _handleCognitoResult(CognitoAuthResult result) async {
    if (!result.isSignedIn) {
      if (!mounted) return;
      setState(() {
        _pendingStep = result.step;
        _confirmationController.clear();
      });
      return;
    }

    final user = await _authService.completeCognitoSignIn();
    if (!mounted) return;
    final displayName =
        user['displayName'] ?? user['phoneNumber'] ?? 'tài khoản';
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop(user);
    } else {
      _showMessage('Đã đăng nhập với $displayName.');
    }
  }

  Future<void> _cancelChallenge() async {
    await _cognitoAuthGateway.signOut();
    if (!mounted) return;
    setState(() {
      _pendingStep = null;
      _confirmationController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              color: Colors.white,
              child: Stack(
                children: [
                  Positioned(
                    top: -92,
                    right: -64,
                    child: _glowCircle(190, _brand.withValues(alpha: 0.12)),
                  ),
                  Positioned(
                    top: 118,
                    left: -74,
                    child: _glowCircle(150, _brand.withValues(alpha: 0.08)),
                  ),
                  ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 44),
                      _buildHero(),
                      const SizedBox(height: 30),
                      _buildAuthCard(),
                      const SizedBox(height: 20),
                      _buildTrustNote(),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _brand,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: const Text(
                'T',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TrustBite',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Review thật, vị ngon thật',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildHero() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 30),
        Center(
          child: RichText(
            textAlign: TextAlign.center,
            text: const TextSpan(
              style: TextStyle(
                fontSize: 30,
                fontWeight: FontWeight.w900,
                height: 1.08,
              ),
              children: [
                TextSpan(
                  text: 'Đăng nhập ',
                  style: TextStyle(color: Color.fromARGB(255, 0, 0, 0)),
                ),
                TextSpan(
                  text: 'TrustBite',
                  style: TextStyle(color: _brand),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _buildAuthCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF4F4F4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.09),
            offset: const Offset(4, 4),
            blurRadius: 16,
          ),
        ],
      ),
      child: Column(
        children: [
          _buildTabs(),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: _pendingStep == null
                ? _buildPhoneFields()
                : _buildConfirmationField(),
          ),
          const SizedBox(height: 16),
          _primaryButton(
            _primaryButtonLabel(),
            _isSubmitting ? null : _handlePrimaryAuth,
          ),
          if (_pendingStep != null)
            TextButton(
              onPressed: _isSubmitting ? null : _cancelChallenge,
              child: const Text('Quay lại'),
            ),
          const SizedBox(height: 16),
          _divider(),
          const SizedBox(height: 16),
          _googleButton(),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [_tabButton(0, 'Đăng nhập'), _tabButton(1, 'Đăng ký')],
      ),
    );
  }

  Widget _tabButton(int index, String label) {
    final active = _activeTab == index;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _pendingStep == null
              ? () => setState(() => _activeTab = index)
              : null,
          borderRadius: BorderRadius.circular(15),
          child: Semantics(
            button: true,
            selected: active,
            label: label,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? _brand : Colors.transparent,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: active ? Colors.white : _muted,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneFields() {
    final helperText = _activeTab == 0
        ? 'Đăng nhập bằng Cognito rồi gửi access token tới backend TrustBite.'
        : 'Tạo tài khoản qua Cognito; TrustBite chỉ nhận token đã xác thực.';

    return Column(
      key: ValueKey('cognito-fields-$_activeTab'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          helperText,
          style: const TextStyle(
            color: _muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 12),
        _inputField(
          controller: _identifierController,
          icon: Icons.person_outline_rounded,
          hint: 'Email hoặc số điện thoại',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.username],
        ),
        const SizedBox(height: 12),
        _inputField(
          controller: _passwordController,
          icon: Icons.lock_outline_rounded,
          hint: 'Mật khẩu Cognito',
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.password],
          obscureText: true,
        ),
      ],
    );
  }

  Widget _buildConfirmationField() {
    final step = _pendingStep!;
    final isNewPassword = step == CognitoAuthStep.confirmNewPassword;
    final description = switch (step) {
      CognitoAuthStep.confirmSignUp =>
        'Nhập mã Cognito đã gửi để xác nhận tài khoản.',
      CognitoAuthStep.confirmSmsMfa => 'Nhập mã MFA được gửi qua SMS.',
      CognitoAuthStep.confirmTotpMfa => 'Nhập mã từ ứng dụng xác thực.',
      CognitoAuthStep.confirmEmailMfa => 'Nhập mã MFA được gửi qua email.',
      CognitoAuthStep.confirmNewPassword =>
        'Cognito yêu cầu bạn đặt mật khẩu mới.',
      CognitoAuthStep.signedIn => '',
    };

    return Column(
      key: ValueKey('cognito-confirm-${step.name}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          description,
          style: const TextStyle(
            color: _muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
        const SizedBox(height: 12),
        _inputField(
          fieldKey: const ValueKey('cognito-confirmation-field'),
          controller: _confirmationController,
          icon: isNewPassword
              ? Icons.lock_reset_rounded
              : Icons.verified_user_outlined,
          hint: isNewPassword ? 'Mật khẩu mới' : 'Mã xác nhận',
          keyboardType: isNewPassword
              ? TextInputType.visiblePassword
              : TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: isNewPassword
              ? const [AutofillHints.newPassword]
              : const [AutofillHints.oneTimeCode],
          obscureText: isNewPassword,
        ),
      ],
    );
  }

  String _primaryButtonLabel() {
    if (_isSubmitting) return 'Đang xử lý...';
    if (_pendingStep != null) return 'Xác nhận';
    return _activeTab == 0 ? 'Tiếp tục với Cognito' : 'Tạo tài khoản Cognito';
  }

  Widget _inputField({
    Key? fieldKey,
    required TextEditingController controller,
    required IconData icon,
    required String hint,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    Iterable<String>? autofillHints,
    bool obscureText = false,
    Widget? suffix,
  }) {
    return Container(
      height: 52,
      padding: const EdgeInsets.only(left: 14, right: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF4F4F4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            offset: const Offset(2, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: TextField(
        key: fieldKey,
        controller: controller,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        autofillHints: autofillHints,
        obscureText: obscureText,
        decoration: InputDecoration(
          icon: Icon(icon, size: 18, color: _brand),
          hintText: hint,
          hintStyle: const TextStyle(
            color: Color(0xFF9CA3AF),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          border: InputBorder.none,
          suffixIcon: suffix,
        ),
      ),
    );
  }

  Widget _primaryButton(String label, VoidCallback? onPressed) {
    return Container(
      height: 52,
      width: double.infinity,
      decoration: BoxDecoration(
        color: _brand,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _brand.withValues(alpha: 0.32),
            offset: const Offset(4, 6),
            blurRadius: 14,
          ),
        ],
      ),
      child: TextButton(
        onPressed: onPressed,
        child: Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }

  Widget _divider() {
    return Row(
      children: [
        Expanded(child: Container(height: 1, color: const Color(0xFFE5E7EB))),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            'hoặc',
            style: TextStyle(
              color: _muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(child: Container(height: 1, color: const Color(0xFFE5E7EB))),
      ],
    );
  }

  Widget _googleButton() {
    return SizedBox(
      height: 52,
      width: double.infinity,
      child: OutlinedButton(
        onPressed:
            widget.onContinueWithGoogle ??
            () => _showMessage('Google sign-in chưa được cấu hình cho mobile.'),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFF0F0F0)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'G',
              style: TextStyle(
                color: _brand,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(width: 10),
            Text(
              'Tiếp tục với Google',
              style: TextStyle(
                color: Colors.black,
                fontSize: 14,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrustNote() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Row(
        children: [
          Icon(Icons.receipt_long_outlined, color: _brand, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'TrustBite bảo vệ tài khoản để đảm bảo đánh giá đến từ người dùng thật.',
              style: TextStyle(
                color: _muted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _glowCircle(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
