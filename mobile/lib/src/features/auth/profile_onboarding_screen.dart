import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/features/auth/mobile_auth_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class ProfileOnboardingScreen extends StatefulWidget {
  const ProfileOnboardingScreen({
    super.key,
    required this.authService,
    required this.initialUser,
  });

  final MobileAuthService authService;
  final Map<String, dynamic> initialUser;

  @override
  State<ProfileOnboardingScreen> createState() =>
      _ProfileOnboardingScreenState();
}

class _ProfileOnboardingScreenState extends State<ProfileOnboardingScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  DateTime? _dateOfBirth;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.initialUser['displayName'] as String? ?? '',
    );
    _phoneController = TextEditingController(
      text: widget.initialUser['phoneNumber'] as String? ?? '',
    );
    final rawDate = widget.initialUser['dateOfBirth'];
    if (rawDate is String) _dateOfBirth = DateTime.tryParse(rawDate);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String? _validate() {
    if (_nameController.text.trim().length < 2) {
      return 'Vui lòng nhập họ và tên.';
    }
    if (_dateOfBirth == null) {
      return 'Vui lòng chọn ngày sinh.';
    }
    if (_phoneController.text.trim().isEmpty) {
      return 'Vui lòng nhập số điện thoại.';
    }
    return null;
  }

  String _formatDate(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/'
      '${value.month.toString().padLeft(2, '0')}/'
      '${value.year}';

  String _apiDate(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-'
      '${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(message, textAlign: TextAlign.center),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.white,
          elevation: 16,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 18),
      firstDate: DateTime(1900),
      lastDate: DateTime(now.year, now.month, now.day),
      helpText: 'Chọn ngày sinh',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
    );
    if (selected != null && mounted) setState(() => _dateOfBirth = selected);
  }

  Future<void> _submit() async {
    final validationMessage = _validate();
    if (validationMessage != null) {
      _showMessage(validationMessage);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final user = await widget.authService.completeProfile(
        displayName: _nameController.text,
        dateOfBirth: _apiDate(_dateOfBirth!),
        phoneNumber: _phoneController.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop(user);
    } on ApiException catch (error) {
      if (mounted) _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _signOut() async {
    await widget.authService.signOut();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  image: DecorationImage(
                    image: AssetImage('assets/bg/bg_main.png'),
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                  ),
                ),
                child: Stack(
                  children: [
                    SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 22, 24, 32),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Image.asset(
                              'assets/app_icon_foreground.png',
                              width: 72,
                              height: 72,
                            ),
                          ),
                          const SizedBox(height: 18),
                          const Text(
                            'Hoàn tất hồ sơ',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF111111),
                              fontSize: 30,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Thông tin giúp tài khoản và các đánh giá của bạn đáng tin cậy hơn.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: HomeColors.muted,
                              fontSize: 13,
                              height: 1.4,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 30),
                          _field(
                            key: const ValueKey('profile-name-field'),
                            controller: _nameController,
                            label: 'Họ và tên',
                            icon: Icons.person_outline_rounded,
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: 14),
                          _dateField(),
                          const SizedBox(height: 14),
                          _field(
                            key: const ValueKey('profile-phone-field'),
                            controller: _phoneController,
                            label: 'Số điện thoại',
                            icon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.done,
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            height: 56,
                            child: FilledButton(
                              key: const ValueKey('profile-submit-button'),
                              onPressed: _isSubmitting ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor: HomeColors.brand,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: Text(
                                _isSubmitting ? 'Đang lưu...' : 'Hoàn tất',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 10,
                      child: IconButton(
                        tooltip: 'Đăng xuất',
                        onPressed: _isSubmitting ? null : _signOut,
                        icon: const Icon(Icons.logout_rounded),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _dateField() {
    return InkWell(
      key: const ValueKey('profile-birth-date-field'),
      onTap: _pickDate,
      borderRadius: BorderRadius.circular(16),
      child: InputDecorator(
        decoration: _decoration('Ngày sinh', Icons.calendar_today_outlined),
        child: Text(
          _dateOfBirth == null ? 'Chọn ngày sinh' : _formatDate(_dateOfBirth!),
          style: TextStyle(
            color: _dateOfBirth == null
                ? const Color(0xFFA3A3AD)
                : const Color(0xFF20202A),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _field({
    required Key key,
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
  }) {
    return TextField(
      key: key,
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      decoration: _decoration(label, icon),
      style: const TextStyle(
        color: Color(0xFF20202A),
        fontWeight: FontWeight.w600,
      ),
    );
  }

  InputDecoration _decoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: HomeColors.brand),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFEAEAEA)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFEAEAEA)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: HomeColors.brand, width: 1.5),
      ),
    );
  }
}
