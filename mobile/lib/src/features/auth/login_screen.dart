import 'package:flutter/material.dart';

/// Login/register entry screen styled after the TrustBite discover screen.
///
/// This is a visual UI only: the buttons and inputs are ready to wire into
/// Cognito-backed auth later, but they do not perform authentication yet.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const Color _brand = Color(0xFFFF5E00);
  static const Color _muted = Color(0xFF8E8E9A);

  int _activeTab = 0;
  int _activeMethod = 0;

  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _obscurePassword = true;

  @override
  void dispose() {
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool get _isRegistering => _activeTab == 1;
  bool get _usesPhone => _activeMethod == 0;

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
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _brand.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          
        ),
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
                TextSpan(text: 'Đăng nhập ', style: TextStyle(color: Color.fromARGB(255, 0, 0, 0))),
                TextSpan(text: 'TrustBite', style: TextStyle(color: _brand)),
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
          _buildMethodSelector(),
          const SizedBox(height: 16),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: _usesPhone ? _buildPhoneFields() : _buildEmailFields(),
          ),
          const SizedBox(height: 16),
          _primaryButton(_isRegistering ? 'Tạo tài khoản' : 'Đăng nhập'),
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
        children: [
          _tabButton(0, 'Đăng nhập'),
          _tabButton(1, 'Đăng ký'),
        ],
      ),
    );
  }

  Widget _tabButton(int index, String label) {
  final active = _activeTab == index;
  return Expanded(
    child: GestureDetector(
      onTap: () => setState(() => _activeTab = index),
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
  );
}


  Widget _buildMethodSelector() {
    return Row(
      children: [
        _methodChip(0, Icons.phone_iphone_rounded, 'SĐT'),
        const SizedBox(width: 10),
        _methodChip(1, Icons.mail_outline_rounded, 'Email'),
      ],
    );
  }

  Widget _methodChip(int index, IconData icon, String label) {
    final active = _activeMethod == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeMethod = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? _brand.withValues(alpha: 0.1) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: active ? _brand : const Color(0xFFF0F0F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: active ? _brand : _muted),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: active ? _brand : _muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneFields() {
    return Column(
      key: const ValueKey('phone-fields'),
      children: [
        _inputField(
          controller: _phoneController,
          icon: Icons.phone_iphone_rounded,
          hint: 'Số điện thoại',
          keyboardType: TextInputType.phone,
        ),
        if (_isRegistering) ...[
          const SizedBox(height: 12),
          _inputField(
            controller: _emailController,
            icon: Icons.mail_outline_rounded,
            hint: 'Email khôi phục (tuỳ chọn)',
            keyboardType: TextInputType.emailAddress,
          ),
        ],
      ],
    );
  }

  Widget _buildEmailFields() {
    return Column(
      key: const ValueKey('email-fields'),
      children: [
        _inputField(
          controller: _emailController,
          icon: Icons.mail_outline_rounded,
          hint: 'Email',
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        _inputField(
          controller: _passwordController,
          icon: Icons.lock_outline_rounded,
          hint: 'Mật khẩu',
          obscureText: _obscurePassword,
          suffix: IconButton(
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            icon: Icon(
              _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 18,
              color: _muted,
            ),
          ),
        ),
      ],
    );
  }

  Widget _inputField({
    required TextEditingController controller,
    required IconData icon,
    required String hint,
    TextInputType? keyboardType,
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
        controller: controller,
        keyboardType: keyboardType,
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

  Widget _primaryButton(String label) {
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
        onPressed: () {},
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
        onPressed: () {},
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFF0F0F0)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('G', style: TextStyle(color: _brand, fontSize: 18, fontWeight: FontWeight.w900)),
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
