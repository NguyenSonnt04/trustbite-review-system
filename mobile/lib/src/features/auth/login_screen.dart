import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/auth/cognito_auth_gateway.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/auth/profile_onboarding_screen.dart';

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

  bool _isSubmitting = false;
  bool _isCognitoSignedIn = false;
  CognitoAuthStep? _pendingStep;

  final TextEditingController _identifierController = TextEditingController();
  final TextEditingController _confirmationController = TextEditingController();

  MobileAuthService get _authService =>
      widget.authService ?? appMobileAuthService;

  CognitoAuthGateway get _cognitoAuthGateway =>
      widget.cognitoAuthGateway ?? appCognitoAuthGateway;

  @override
  void dispose() {
    _identifierController.dispose();
    _confirmationController.dispose();
    super.dispose();
  }

  void _showMessage(String message) {
    final screenHeight = MediaQuery.sizeOf(context).height;

    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.white,
        elevation: 18,
        margin: EdgeInsets.fromLTRB(28, 0, 28, screenHeight * 0.44),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFFF0F0F0)),
        ),
        content: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 14,
            height: 1.25,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  Future<void> _handlePrimaryAuth() async {
    setState(() => _isSubmitting = true);
    try {
      if (_isCognitoSignedIn) {
        await _completeBackendSignIn();
        return;
      }

      late final CognitoAuthResult result;
      final pendingStep = _pendingStep;
      if (pendingStep != null) {
        result = pendingStep == CognitoAuthStep.confirmSignUp
            ? await _cognitoAuthGateway.confirmSignUp(
                identifier: _identifierController.text,
                confirmationValue: _confirmationController.text,
              )
            : await _cognitoAuthGateway.confirmOtp(
                _confirmationController.text,
              );
      } else {
        result = await _cognitoAuthGateway.requestOtp(
          identifier: _identifierController.text,
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
      if (err.restartAuthentication) {
        await _cancelChallenge();
      }
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

    if (mounted) {
      setState(() {
        _isCognitoSignedIn = true;
        _pendingStep = null;
        _confirmationController.clear();
      });
    }
    await _completeBackendSignIn();
  }

  Future<void> _completeBackendSignIn() async {
    var user = await _authService.completeCognitoSignIn();
    if (!mounted) return;
    if (user['profileComplete'] != true) {
      final completedUser = await Navigator.of(context)
          .push<Map<String, dynamic>>(
            MaterialPageRoute<Map<String, dynamic>>(
              builder: (_) => ProfileOnboardingScreen(
                authService: _authService,
                initialUser: user,
              ),
            ),
          );
      if (!mounted) return;
      if (completedUser == null) {
        setState(() => _isCognitoSignedIn = false);
        return;
      }
      user = completedUser;
    }
    final displayName =
        user['displayName'] ?? user['phoneNumber'] ?? 'tài khoản';
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop(user);
    } else {
      _showMessage('Đã đăng nhập với $displayName.');
    }
  }

  Future<void> _cancelChallenge() async {
    try {
      await _cognitoAuthGateway.signOut();
    } on Exception {
      // The local UI can still restart when a stale provider session cannot be
      // cleared, and the next Cognito sign-in will establish a fresh session.
    }
    if (!mounted) return;
    setState(() {
      _isCognitoSignedIn = false;
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
                      const SizedBox(height: 18),
                      _buildHero(),
                      const SizedBox(height: 30),
                      _buildAuthCard(),
                      const SizedBox(height: 20),
                      _buildTrustNote(),
                      const SizedBox(height: 24),
                      _buildAssuranceStrip(),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: _brand,
            borderRadius: BorderRadius.circular(16),
          ),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(5),
            child: Image.asset(
              'assets/app_icon_foreground.png',
              fit: BoxFit.contain,
            ),
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          'TrustBite',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.black,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'Review thật, vị ngon thật',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: _muted,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _buildHero() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                  text: 'Xác thực ',
                  style: TextStyle(color: Color.fromARGB(255, 0, 0, 0)),
                ),
                TextSpan(
                  text: 'tài khoản',
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
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: _isCognitoSignedIn
                ? _buildBackendRetryState()
                : _pendingStep == null
                ? _buildIdentifierFields()
                : _buildConfirmationField(),
          ),
          const SizedBox(height: 18),
          _primaryButton(
            _primaryButtonLabel(),
            _isSubmitting ? null : _handlePrimaryAuth,
          ),
          if (_pendingStep != null || _isCognitoSignedIn)
            TextButton(
              onPressed: _isSubmitting ? null : _cancelChallenge,
              child: const Text('Quay lại'),
            ),
          const SizedBox(height: 18),
          _divider(),
          const SizedBox(height: 18),
          _googleButton(),
        ],
      ),
    );
  }

  Widget _buildIdentifierFields() {
    return Column(
      key: const ValueKey('cognito-identifier-fields'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Nhập email để nhận mã xác thực tài khoản.',
          style: TextStyle(
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
          hint: 'Email',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
        ),
      ],
    );
  }

  Widget _buildConfirmationField() {
    final step = _pendingStep!;
    final description = switch (step) {
      CognitoAuthStep.confirmOtp => 'Nhập mã xác thực đã gửi để tiếp tục.',
      CognitoAuthStep.confirmSignUp =>
        'Nhập mã xác thực đã gửi để xác nhận tài khoản.',
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
          icon: Icons.verified_user_outlined,
          hint: 'Mã xác nhận',
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.oneTimeCode],
        ),
      ],
    );
  }

  Widget _buildBackendRetryState() {
    return const Align(
      key: ValueKey('backend-retry-state'),
      alignment: Alignment.centerLeft,
      child: Text(
        'Tài khoản đã xác thực. Kết nối TrustBite để hoàn tất đăng nhập.',
        style: TextStyle(
          color: _muted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          height: 1.35,
        ),
      ),
    );
  }

  String _primaryButtonLabel() {
    if (_isSubmitting) return 'Đang xử lý...';
    if (_isCognitoSignedIn) return 'Thử lại';
    if (_pendingStep != null) return 'Xác nhận';
    return 'Tiếp tục';
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
            _GoogleGLogo(size: 18),
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
          Icon(Icons.receipt_long_outlined, color: Colors.black, size: 20),
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

  Widget _buildAssuranceStrip() {
    return Row(
      children: [
        Expanded(
          child: _assuranceItem(Icons.verified_user_outlined, 'Tài khoản thật'),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _assuranceItem(Icons.receipt_long_outlined, 'Review có kiểm'),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _assuranceItem(Icons.lock_outline_rounded, 'Dữ liệu an toàn'),
        ),
      ],
    );
  }

  Widget _assuranceItem(IconData icon, String label) {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0F0F0)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: Colors.black, size: 19),
          const SizedBox(height: 7),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xFF737383),
              fontSize: 11,
              height: 1.15,
              fontWeight: FontWeight.w800,
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

class _GoogleGLogo extends StatelessWidget {
  const _GoogleGLogo({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: const _GoogleGLogoPainter(),
    );
  }
}

class _GoogleGLogoPainter extends CustomPainter {
  const _GoogleGLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = size.shortestSide * 0.18;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: (size.shortestSide - strokeWidth) / 2,
    );

    Paint stroke(Color color) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.butt;

    canvas
      ..drawArc(rect, 4.02, 1.20, false, stroke(const Color(0xFFEA4335)))
      ..drawArc(rect, 2.85, 1.18, false, stroke(const Color(0xFFFBBC05)))
      ..drawArc(rect, 1.28, 1.58, false, stroke(const Color(0xFF34A853)))
      ..drawArc(rect, -0.03, 1.30, false, stroke(const Color(0xFF4285F4)));

    final blue = stroke(const Color(0xFF4285F4))..strokeCap = StrokeCap.butt;
    canvas.drawLine(
      Offset(size.width * 0.52, size.height * 0.50),
      Offset(size.width * 0.90, size.height * 0.50),
      blue,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
