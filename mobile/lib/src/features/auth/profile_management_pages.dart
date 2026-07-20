import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/api/trustbite_api_client.dart';
import 'package:trustbite_mobile/src/core/theme/app_typography.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({
    super.key,
    required this.currentUser,
    required this.repository,
    required this.onDeletionAccepted,
  });

  final Map<String, dynamic> currentUser;
  final ProfileManagementRepository repository;
  final Future<void> Function() onDeletionAccepted;

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _dateController;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.currentUser['displayName']?.toString() ?? '',
    );
    _phoneController = TextEditingController(
      text: widget.currentUser['phoneNumber']?.toString() ?? '',
    );
    _dateController = TextEditingController(
      text: widget.currentUser['dateOfBirth']?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _dateController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final profile = await widget.repository.updateProfile(
        displayName: _nameController.text,
        phoneNumber: _phoneController.text,
        dateOfBirth: _dateController.text,
      );
      if (mounted) Navigator.of(context).pop(profile);
    } on Exception catch (error) {
      if (!mounted) return;
      _showError(error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAvatar() async {
    if (_saving) return;
    final source = await _selectAvatarSource();
    if (source == null || !mounted) return;
    try {
      final image = await ImagePicker().pickImage(
        source: source,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 1200,
        imageQuality: 88,
      );
      if (image == null || !mounted) return;
      final extension = image.name.split('.').last.toLowerCase();
      final contentType = switch (extension) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        _ => 'image/jpeg',
      };
      setState(() => _saving = true);
      final profile = await widget.repository.updateAvatar(
        bytes: await image.readAsBytes(),
        contentType: contentType,
      );
      if (!mounted) return;
      Navigator.of(context).pop(profile);
    } on Exception catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<ImageSource?> _selectAvatarSource() {
    return showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => const _AvatarSourceSheet(),
    );
  }

  Future<void> _openAccountDeletion() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => AccountDeletionPage(
          repository: widget.repository,
          onDeletionAccepted: widget.onDeletionAccepted,
        ),
      ),
    );
  }

  void _showError(Object error) {
    final message = switch (error) {
      ApiException(:final message) => message,
      FormatException() => 'Dữ liệu hồ sơ không hợp lệ.',
      _ => 'Không thể cập nhật hồ sơ. Vui lòng thử lại.',
    };
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final avatarUrl = widget.currentUser['avatarUrl']?.toString();
    return Scaffold(
      key: const ValueKey('edit-profile-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F7F8),
          image: DecorationImage(
            image: AssetImage('assets/bg/bg_main.png'),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            opacity: 0.42,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const _EditProfileHeader(),
              Expanded(
                child: ListView(
                  key: const ValueKey('edit-profile-content'),
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
                  children: [
                    _EditProfileAvatarCard(
                      avatarUrl: avatarUrl,
                      displayName: _nameController.text,
                      phoneNumber: _phoneController.text,
                      enabled: !_saving,
                      onEdit: _pickAvatar,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Thông tin cá nhân',
                      style: AppTypography.sectionTitle,
                    ),
                    const SizedBox(height: 12),
                    _ProfileFormCard(
                      nameController: _nameController,
                      phoneController: _phoneController,
                      dateController: _dateController,
                      enabled: !_saving,
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      key: const ValueKey('save-profile-button'),
                      onPressed: _saving ? null : _save,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        backgroundColor: HomeColors.brand,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: const Color(0xFFFFAB7A),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                        elevation: 0,
                        textStyle: AppTypography.button,
                      ),
                      child: _saving
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Lưu thay đổi'),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Quản lý tài khoản',
                      style: AppTypography.sectionTitle,
                    ),
                    const SizedBox(height: 12),
                    _DeleteAccountCard(
                      enabled: !_saving,
                      onTap: _openAccountDeletion,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EditProfileHeader extends StatelessWidget {
  const _EditProfileHeader();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 68,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Quay lại',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            const Expanded(
              child: Text('Hồ sơ cá nhân', style: AppTypography.cardTitle),
            ),
            const SizedBox(width: 48),
          ],
        ),
      ),
    );
  }
}

class _EditProfileAvatarCard extends StatelessWidget {
  const _EditProfileAvatarCard({
    required this.avatarUrl,
    required this.displayName,
    required this.phoneNumber,
    required this.enabled,
    required this.onEdit,
  });

  final String? avatarUrl;
  final String displayName;
  final String phoneNumber;
  final bool enabled;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final safeDisplayName = displayName.trim().isEmpty
        ? 'Tài khoản TrustBite'
        : displayName.trim();
    final safePhoneNumber = phoneNumber.trim().isEmpty
        ? 'Chưa cập nhật số điện thoại'
        : phoneNumber.trim();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0xFFF1EDE8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.055),
            offset: const Offset(0, 12),
            blurRadius: 28,
          ),
        ],
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 82,
                height: 82,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF2F3F5),
                  border: Border.all(color: const Color(0xFFE5E7EB), width: 2),
                ),
                child: ClipOval(
                  child: OptimizedNetworkImage(
                    imageUrl: avatarUrl,
                    width: 76,
                    height: 76,
                    semanticLabel: 'Ảnh đại diện của $safeDisplayName',
                    fallbackIconSize: 36,
                  ),
                ),
              ),
              Positioned(
                right: -2,
                bottom: 0,
                child: IconButton.filled(
                  key: const ValueKey('edit-avatar-button'),
                  tooltip: 'Đổi ảnh đại diện',
                  onPressed: enabled ? onEdit : null,
                  style: IconButton.styleFrom(
                    minimumSize: const Size.square(34),
                    maximumSize: const Size.square(34),
                    padding: EdgeInsets.zero,
                    backgroundColor: HomeColors.brand,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFFFAB7A),
                    side: const BorderSide(color: Colors.white, width: 2),
                  ),
                  icon: const Icon(Icons.photo_camera_rounded, size: 17),
                ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  safeDisplayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.cardTitle,
                ),
                const SizedBox(height: 5),
                Text(
                  safePhoneNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: const Color(0xFF777781),
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  'Chạm biểu tượng camera để đổi ảnh',
                  style: AppTypography.tiny.copyWith(color: HomeColors.brand),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileFormCard extends StatelessWidget {
  const _ProfileFormCard({
    required this.nameController,
    required this.phoneController,
    required this.dateController,
    required this.enabled,
  });

  final TextEditingController nameController;
  final TextEditingController phoneController;
  final TextEditingController dateController;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1EDE8)),
      ),
      child: Column(
        children: [
          _ProfileTextField(
            fieldKey: const ValueKey('edit-profile-name'),
            controller: nameController,
            enabled: enabled,
            label: 'Tên hiển thị',
            icon: Icons.person_outline_rounded,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _ProfileTextField(
            fieldKey: const ValueKey('edit-profile-phone'),
            controller: phoneController,
            enabled: enabled,
            label: 'Số điện thoại',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _ProfileTextField(
            fieldKey: const ValueKey('edit-profile-date-of-birth'),
            controller: dateController,
            enabled: enabled,
            label: 'Ngày sinh',
            hintText: 'YYYY-MM-DD',
            icon: Icons.cake_outlined,
            keyboardType: TextInputType.datetime,
          ),
        ],
      ),
    );
  }
}

class _AvatarSourceSheet extends StatelessWidget {
  const _AvatarSourceSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFD9D9DE),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 20),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Cập nhật ảnh đại diện',
                style: AppTypography.cardTitle,
              ),
            ),
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Chọn cách bạn muốn thêm ảnh mới.',
                style: AppTypography.body.copyWith(color: HomeColors.muted),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _AvatarSourceButton(
                    key: const ValueKey('avatar-source-camera'),
                    icon: Icons.photo_camera_rounded,
                    label: 'Chụp ảnh',
                    onTap: () => Navigator.of(context).pop(ImageSource.camera),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _AvatarSourceButton(
                    key: const ValueKey('avatar-source-gallery'),
                    icon: Icons.photo_library_rounded,
                    label: 'Thư viện',
                    onTap: () => Navigator.of(context).pop(ImageSource.gallery),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              key: const ValueKey('avatar-source-cancel'),
              onPressed: () => Navigator.of(context).pop(),
              style: TextButton.styleFrom(
                foregroundColor: HomeColors.muted,
                minimumSize: const Size.fromHeight(48),
              ),
              child: const Text('Hủy'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AvatarSourceButton extends StatelessWidget {
  const _AvatarSourceButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF3EC),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: HomeColors.brand,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: Colors.white, size: 25),
              ),
              const SizedBox(height: 10),
              Text(label, style: AppTypography.bodyStrong),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileTextField extends StatelessWidget {
  const _ProfileTextField({
    required this.fieldKey,
    required this.controller,
    required this.enabled,
    required this.label,
    required this.icon,
    this.hintText,
    this.keyboardType,
    this.textInputAction,
  });

  final Key fieldKey;
  final TextEditingController controller;
  final bool enabled;
  final String label;
  final IconData icon;
  final String? hintText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    const border = OutlineInputBorder(
      borderRadius: BorderRadius.all(Radius.circular(16)),
      borderSide: BorderSide(color: Color(0xFFE7E8EB)),
    );
    return TextField(
      key: fieldKey,
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: AppTypography.bodyStrong,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        labelStyle: AppTypography.label.copyWith(
          color: const Color(0xFF6E7178),
        ),
        prefixIcon: Icon(icon, color: const Color(0xFF777C84), size: 21),
        filled: true,
        fillColor: const Color(0xFFF8F8FA),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 17,
        ),
        enabledBorder: border,
        disabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: const BorderSide(color: HomeColors.brand, width: 1.5),
        ),
      ),
    );
  }
}

class _DeleteAccountCard extends StatelessWidget {
  const _DeleteAccountCard({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        key: const ValueKey('open-delete-account-button'),
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF4D8D5)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEECE9),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.delete_outline_rounded,
                  color: Color(0xFFB42318),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Xóa tài khoản',
                      style: AppTypography.bodyStrong.copyWith(
                        color: const Color(0xFFB42318),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Xem trạng thái hoặc gửi yêu cầu xóa',
                      style: AppTypography.caption.copyWith(
                        color: const Color(0xFF7C7C86),
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFFB6A09E)),
            ],
          ),
        ),
      ),
    );
  }
}

class GamificationPage extends StatefulWidget {
  const GamificationPage({super.key, required this.repository});

  final ProfileManagementRepository repository;

  @override
  State<GamificationPage> createState() => _GamificationPageState();
}

class _GamificationPageState extends State<GamificationPage> {
  late Future<GamificationSummary> _summary;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  @override
  void didUpdateWidget(covariant GamificationPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.repository != widget.repository) {
      _loadSummary();
    }
  }

  void _loadSummary() {
    _summary = widget.repository.fetchGamification();
  }

  Future<void> _refresh() async {
    final request = widget.repository.fetchGamification();
    setState(() {
      _summary = request;
    });
    await request;
  }

  void _retry() {
    setState(_loadSummary);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: const ValueKey('gamification-page'),
      backgroundColor: const Color(0xFFF7F7F8),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F7F8),
          image: DecorationImage(
            image: AssetImage('assets/bg/bg_main.png'),
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
            opacity: 0.34,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _GamificationHeader(onRefresh: _refresh),
              Expanded(
                child: FutureBuilder<GamificationSummary>(
                  future: _summary,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState != ConnectionState.done) {
                      return const _GamificationLoading();
                    }
                    if (snapshot.hasError) {
                      return _GamificationError(onRetry: _retry);
                    }
                    return _GamificationContent(
                      summary: snapshot.requireData,
                      onRefresh: _refresh,
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GamificationHeader extends StatelessWidget {
  const _GamificationHeader({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 68,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Quay lại',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 4),
            const Expanded(
              child: Text('Hạng thành viên', style: AppTypography.cardTitle),
            ),
            IconButton(
              tooltip: 'Làm mới tiến trình',
              onPressed: () {
                onRefresh();
              },
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _GamificationLoading extends StatelessWidget {
  const _GamificationLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(color: HomeColors.brand),
    );
  }
}

class _GamificationError extends StatelessWidget {
  const _GamificationError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFF0ECE8)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.cloud_off_rounded,
                size: 44,
                color: HomeColors.muted,
              ),
              const SizedBox(height: 14),
              const Text(
                'Không thể tải hạng thành viên',
                textAlign: TextAlign.center,
                style: AppTypography.title,
              ),
              const SizedBox(height: 6),
              Text(
                'Kiểm tra kết nối rồi thử lại để cập nhật EXP và huy hiệu.',
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(color: HomeColors.muted),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                key: const ValueKey('gamification-retry'),
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                  backgroundColor: HomeColors.brand,
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GamificationContent extends StatelessWidget {
  const _GamificationContent({required this.summary, required this.onRefresh});

  final GamificationSummary summary;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: HomeColors.brand,
      onRefresh: onRefresh,
      child: ListView(
        key: const ValueKey('gamification-summary'),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          _MembershipHero(summary: summary),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _GamificationStatCard(
                  icon: Icons.bolt_rounded,
                  label: 'Điểm kinh nghiệm',
                  value: '${summary.expPoints}',
                  suffix: 'EXP',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _GamificationStatCard(
                  icon: Icons.verified_rounded,
                  label: 'Review xác thực',
                  value: '${summary.verifiedReviewCount}',
                  suffix: 'review',
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Huy hiệu của bạn',
                  style: AppTypography.sectionTitle,
                ),
              ),
              if (summary.badges.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: HomeColors.brand.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${summary.badges.length}',
                    style: AppTypography.labelStrong.copyWith(
                      color: HomeColors.brand,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (summary.badges.isEmpty)
            const _BadgeEmptyState()
          else
            for (var index = 0; index < summary.badges.length; index++) ...[
              _BadgeCard(badge: summary.badges[index]),
              if (index != summary.badges.length - 1)
                const SizedBox(height: 10),
            ],
          const SizedBox(height: 22),
          const _GamificationTipCard(),
        ],
      ),
    );
  }
}

class _MembershipHero extends StatelessWidget {
  const _MembershipHero({required this.summary});

  final GamificationSummary summary;

  @override
  Widget build(BuildContext context) {
    final next = summary.nextLevel;
    final expProgress = next == null || next.minExp <= summary.level.minExp
        ? 1.0
        : ((summary.expPoints - summary.level.minExp) /
                  (next.minExp - summary.level.minExp))
              .clamp(0.0, 1.0);
    final reviewProgress =
        next == null ||
            next.minVerifiedReviews <= summary.level.minVerifiedReviews
        ? 1.0
        : ((summary.verifiedReviewCount - summary.level.minVerifiedReviews) /
                  (next.minVerifiedReviews - summary.level.minVerifiedReviews))
              .clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF5E00), Color(0xFFFF8A45), Color(0xFFFFA36A)],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: HomeColors.brand.withValues(alpha: 0.24),
            offset: const Offset(0, 14),
            blurRadius: 28,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(color: Colors.white24),
                ),
                child: const Icon(
                  Icons.workspace_premium_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hạng hiện tại',
                      style: AppTypography.caption.copyWith(
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      summary.level.label,
                      style: AppTypography.screenTitle.copyWith(
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  summary.level.code,
                  style: AppTypography.tiny.copyWith(color: HomeColors.brand),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (next == null)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.stars_rounded, color: Colors.white),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Bạn đã đạt hạng cao nhất trong hệ thống hiện tại.',
                      style: AppTypography.bodyStrong.copyWith(
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else ...[
            Text(
              'Tiến tới ${next.label}',
              style: AppTypography.bodyStrong.copyWith(color: Colors.white),
            ),
            const SizedBox(height: 14),
            _HeroProgressRow(
              label: 'EXP',
              value: expProgress,
              currentText: '${summary.expPoints}/${next.minExp}',
            ),
            const SizedBox(height: 12),
            _HeroProgressRow(
              label: 'Review xác thực',
              value: reviewProgress,
              currentText:
                  '${summary.verifiedReviewCount}/${next.minVerifiedReviews}',
            ),
            const SizedBox(height: 14),
            Text(
              'Còn ${next.expToNext} EXP và ${next.verifiedReviewsToNext} review xác thực để thăng hạng.',
              style: AppTypography.caption.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroProgressRow extends StatelessWidget {
  const _HeroProgressRow({
    required this.label,
    required this.value,
    required this.currentText,
  });

  final String label;
  final double value;
  final String currentText;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppTypography.caption.copyWith(color: Colors.white70),
              ),
            ),
            Text(
              currentText,
              style: AppTypography.caption.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        LinearProgressIndicator(
          value: value,
          minHeight: 8,
          borderRadius: BorderRadius.circular(999),
          backgroundColor: Colors.white24,
          color: Colors.white,
        ),
      ],
    );
  }
}

class _GamificationStatCard extends StatelessWidget {
  const _GamificationStatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.suffix,
  });

  final IconData icon;
  final String label;
  final String value;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0ECE8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: HomeColors.brand, size: 20),
          ),
          const SizedBox(height: 13),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(value, style: AppTypography.cardTitle),
              const SizedBox(width: 4),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    suffix,
                    maxLines: 1,
                    style: AppTypography.tiny.copyWith(color: HomeColors.muted),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 2,
            style: AppTypography.caption.copyWith(color: HomeColors.muted),
          ),
        ],
      ),
    );
  }
}

class _BadgeEmptyState extends StatelessWidget {
  const _BadgeEmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF0ECE8)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFFFEEE5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.military_tech_rounded,
              color: HomeColors.brand,
              size: 27,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Chưa có huy hiệu', style: AppTypography.bodyStrong),
                const SizedBox(height: 5),
                Text(
                  'Hoàn thành review có hóa đơn để mở khóa các cột mốc uy tín.',
                  style: AppTypography.caption.copyWith(
                    color: HomeColors.muted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeCard extends StatelessWidget {
  const _BadgeCard({required this.badge});

  final GamificationBadge badge;

  @override
  Widget build(BuildContext context) {
    final awardedAt = badge.awardedAt.toLocal();
    final awardedDate =
        '${awardedAt.day.toString().padLeft(2, '0')}/'
        '${awardedAt.month.toString().padLeft(2, '0')}/${awardedAt.year}';

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF0ECE8)),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFEEE5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: badge.iconUrl == null
                ? const Icon(
                    Icons.workspace_premium_rounded,
                    color: HomeColors.brand,
                  )
                : ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: OptimizedNetworkImage(
                      imageUrl: badge.iconUrl,
                      width: 34,
                      height: 34,
                      semanticLabel: 'Huy hiệu ${badge.label}',
                      fallbackIconSize: 20,
                    ),
                  ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(badge.label, style: AppTypography.bodyStrong),
                const SizedBox(height: 4),
                Text(
                  badge.category ?? badge.code,
                  style: AppTypography.caption.copyWith(
                    color: HomeColors.muted,
                  ),
                ),
              ],
            ),
          ),
          Text(
            awardedDate,
            style: AppTypography.tiny.copyWith(color: HomeColors.muted),
          ),
        ],
      ),
    );
  }
}

class _GamificationTipCard extends StatelessWidget {
  const _GamificationTipCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3EC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFFDDC9)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lightbulb_rounded, color: HomeColors.brand),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Review được xác thực bằng hóa đơn giúp tăng EXP và xây dựng độ tin cậy cho cộng đồng.',
              style: AppTypography.caption.copyWith(
                color: const Color(0xFF6B3A20),
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class SafetyCenterPage extends StatelessWidget {
  const SafetyCenterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return _ManagementScaffold(
      title: 'Trung tâm an toàn',
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _SafetyCard(
            icon: Icons.flag_rounded,
            title: 'Báo cáo nội dung',
            message:
                'Mở nhà hàng hoặc review, chạm menu ba chấm và chọn Báo cáo. TrustBite chỉ gửi mã lý do và mô tả bạn nhập.',
          ),
          SizedBox(height: 14),
          _SafetyCard(
            icon: Icons.block_rounded,
            title: 'Chặn tác giả review',
            message:
                'Trong menu của review, chọn Chặn tác giả. Danh tính nội bộ của người dùng không được hiển thị cho ứng dụng.',
          ),
          SizedBox(height: 14),
          _SafetyCard(
            icon: Icons.privacy_tip_rounded,
            title: 'Quyền riêng tư',
            message:
                'Báo cáo không tự động xóa nội dung. Đội kiểm duyệt sẽ xem xét theo chính sách cộng đồng.',
          ),
        ],
      ),
    );
  }
}

class AccountDeletionPage extends StatefulWidget {
  const AccountDeletionPage({
    super.key,
    required this.repository,
    required this.onDeletionAccepted,
  });

  final ProfileManagementRepository repository;
  final Future<void> Function() onDeletionAccepted;

  @override
  State<AccountDeletionPage> createState() => _AccountDeletionPageState();
}

class _AccountDeletionPageState extends State<AccountDeletionPage> {
  late Future<AccountDeletionRequest?> _request;
  final _confirmationController = TextEditingController();
  final _reasonController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _request = widget.repository.fetchAccountDeletionRequest();
  }

  @override
  void dispose() {
    _confirmationController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_confirmationController.text.trim() != 'XÓA TÀI KHOẢN') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập đúng XÓA TÀI KHOẢN.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await widget.repository.requestAccountDeletion(
        reason: _reasonController.text,
      );
      await widget.onDeletionAccepted();
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on Exception {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể gửi yêu cầu xóa tài khoản.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _cancel() async {
    setState(() => _submitting = true);
    try {
      await widget.repository.cancelAccountDeletion();
      if (mounted) setState(() => _request = Future.value(null));
    } on Exception {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Yêu cầu hiện không thể hủy.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _ManagementScaffold(
      title: 'Xóa tài khoản',
      child: FutureBuilder<AccountDeletionRequest?>(
        future: _request,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(
              child: CircularProgressIndicator(color: HomeColors.brand),
            );
          }
          if (snapshot.hasError) {
            return _CenteredMessage(
              icon: Icons.cloud_off_rounded,
              title: 'Không thể tải yêu cầu xóa',
              message: 'Vui lòng kiểm tra kết nối và thử lại.',
              actionLabel: 'Thử lại',
              onAction: () => setState(
                () =>
                    _request = widget.repository.fetchAccountDeletionRequest(),
              ),
            );
          }
          final request = snapshot.data;
          if (request != null && request.status == 'REQUESTED') {
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const _InlineInfo(
                  icon: Icons.schedule_rounded,
                  text:
                      'Yêu cầu xóa đang trong thời gian chờ. Bạn có thể hủy trước khi hệ thống bắt đầu xử lý.',
                ),
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: _submitting ? null : _cancel,
                  child: const Text('Hủy yêu cầu xóa'),
                ),
              ],
            );
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const _InlineInfo(
                icon: Icons.warning_amber_rounded,
                text:
                    'Bạn sẽ bị đăng xuất ngay. Dữ liệu cá nhân được xóa hoặc ẩn danh, còn bằng chứng chống gian lận và audit tối thiểu có thể được giữ theo chính sách.',
              ),
              const SizedBox(height: 22),
              TextField(
                key: const ValueKey('delete-account-reason'),
                controller: _reasonController,
                maxLength: 500,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Lý do (không bắt buộc)',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                key: const ValueKey('delete-account-confirmation'),
                controller: _confirmationController,
                decoration: const InputDecoration(
                  labelText: 'Nhập XÓA TÀI KHOẢN để xác nhận',
                ),
              ),
              const SizedBox(height: 22),
              FilledButton(
                key: const ValueKey('delete-account-submit'),
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  backgroundColor: const Color(0xFFB42318),
                ),
                child: const Text('Gửi yêu cầu xóa'),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ManagementScaffold extends StatelessWidget {
  const _ManagementScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F8FA),
      appBar: AppBar(
        title: Text(title),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: SafeArea(child: child),
    );
  }
}

class _CenteredMessage extends StatelessWidget {
  const _CenteredMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 46, color: HomeColors.muted),
            const SizedBox(height: 14),
            Text(title, style: AppTypography.title),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.body,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onAction,
                style: FilledButton.styleFrom(
                  backgroundColor: HomeColors.brand,
                ),
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InlineInfo extends StatelessWidget {
  const _InlineInfo({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFEDEEF1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: HomeColors.brand),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text, style: AppTypography.body.copyWith(height: 1.45)),
          ),
        ],
      ),
    );
  }
}

class _SafetyCard extends StatelessWidget {
  const _SafetyCard({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFEDEEF1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: HomeColors.brand.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: HomeColors.brand),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.bodyStrong),
                const SizedBox(height: 5),
                Text(
                  message,
                  style: AppTypography.caption.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
