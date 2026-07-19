import 'package:flutter/material.dart';
import 'package:trustbite_mobile/src/common/widgets/optimized_network_image.dart';
import 'package:trustbite_mobile/src/core/auth/app_auth.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_pages.dart';
import 'package:trustbite_mobile/src/features/auth/profile_management_service.dart';
import 'package:trustbite_mobile/src/features/home/home_tokens.dart';

const _profileIconColor = Color(0xFF303038);
const _profileIconBackground = Color(0xFFF1F3F5);

class ProfilePage extends StatelessWidget {
  const ProfilePage({
    super.key,
    required this.isSignedIn,
    required this.currentUser,
    required this.onLogin,
    required this.onLogout,
    required this.onUserUpdated,
    required this.onAccountDeletionAccepted,
    this.profileRepository,
  });

  final bool isSignedIn;
  final Map<String, dynamic>? currentUser;
  final Future<bool> Function() onLogin;
  final Future<void> Function() onLogout;
  final ValueChanged<Map<String, dynamic>> onUserUpdated;
  final Future<void> Function() onAccountDeletionAccepted;
  final ProfileManagementRepository? profileRepository;

  @override
  Widget build(BuildContext context) {
    final repository =
        profileRepository ?? ProfileManagementService(apiClient: appApiClient);

    Future<bool> requireSignIn() async {
      if (isSignedIn) return true;
      return onLogin();
    }

    Future<void> openEditProfile() async {
      if (!await requireSignIn() || !context.mounted) return;
      final updated = await Navigator.of(context).push<Map<String, dynamic>>(
        MaterialPageRoute<Map<String, dynamic>>(
          builder: (_) => EditProfilePage(
            currentUser: currentUser ?? const {},
            repository: repository,
            onDeletionAccepted: onAccountDeletionAccepted,
          ),
        ),
      );
      if (updated != null) onUserUpdated(updated);
    }

    Future<void> openSignedInPage(Widget page) async {
      if (!await requireSignIn() || !context.mounted) return;
      await Navigator.of(
        context,
      ).push<void>(MaterialPageRoute<void>(builder: (_) => page));
    }

    return ListView(
      key: ValueKey('profile-page-$isSignedIn'),
      padding: const EdgeInsets.only(bottom: 110),
      children: [
        const SizedBox(height: 20),
        if (isSignedIn)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _SignedInProfileCard(
              currentUser: currentUser,
              onTap: openEditProfile,
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _LoginPromptCard(onLogin: onLogin),
          ),
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: _ProfileActionSection(
            title: 'Tác vụ',
            items: [
              const _ProfileActionItem(
                icon: Icons.receipt_long_rounded,
                label: 'Quét bill',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
              const _ProfileActionItem(
                icon: Icons.local_offer_rounded,
                label: 'Mã ưu đãi',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
              const _ProfileActionItem(
                icon: Icons.support_agent_rounded,
                label: 'Hỗ trợ',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
              _ProfileActionItem(
                icon: Icons.shield_rounded,
                label: 'Bảo mật',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
                onTap: () => openSignedInPage(const SafetyCenterPage()),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: _ProfileActionSection(
            title: 'Tiện ích & Ưu đãi',
            items: [
              _ProfileActionItem(
                icon: Icons.workspace_premium_rounded,
                label: 'Hạng thành viên',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
                onTap: () =>
                    openSignedInPage(GamificationPage(repository: repository)),
              ),
              const _ProfileActionItem(
                icon: Icons.verified_rounded,
                label: 'Hội viên',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
              const _ProfileActionItem(
                icon: Icons.card_giftcard_rounded,
                label: 'Thẻ quà tặng',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
              const _ProfileActionItem(
                icon: Icons.group_add_rounded,
                label: 'Giới thiệu bạn bè',
                iconColor: _profileIconColor,
                iconBackground: _profileIconBackground,
              ),
            ],
          ),
        ),
        const SizedBox(height: 34),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _GeneralSettingsSection(
            showLogout: isSignedIn,
            onLogout: onLogout,
          ),
        ),
      ],
    );
  }
}

class _SignedInProfileCard extends StatelessWidget {
  const _SignedInProfileCard({required this.currentUser, required this.onTap});

  final Map<String, dynamic>? currentUser;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final displayName =
        currentUser?['displayName'] ??
        currentUser?['phoneNumber'] ??
        'Tài khoản TrustBite';
    final phoneNumber = currentUser?['phoneNumber'];
    final avatarUrl = currentUser?['avatarUrl']?.toString();

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFE5E7EB),
                      width: 2,
                    ),
                  ),
                  child: ClipOval(
                    child: OptimizedNetworkImage(
                      imageUrl: avatarUrl,
                      width: 52,
                      height: 52,
                      semanticLabel: 'Ảnh đại diện của $displayName',
                      fallbackIconSize: 28,
                    ),
                  ),
                ),
                Positioned(
                  right: -2,
                  bottom: 0,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: HomeColors.brand,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFF8FAFC),
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.edit_rounded,
                      size: 11,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName.toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF111827),
                      fontSize: 18,
                      height: 1.05,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    phoneNumber is String
                        ? phoneNumber
                        : 'Chạm để cập nhật hồ sơ',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF7C7C86),
                      fontSize: 13,
                      height: 1.1,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

class _ProfileActionSection extends StatelessWidget {
  const _ProfileActionSection({required this.title, required this.items});

  final String title;
  final List<_ProfileActionItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 20,
            height: 1.1,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          padding: EdgeInsets.zero,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 9,
            childAspectRatio: 3.7,
          ),
          itemBuilder: (context, index) {
            return _ProfileActionTile(item: items[index]);
          },
        ),
      ],
    );
  }
}

class _ProfileActionTile extends StatelessWidget {
  const _ProfileActionTile({required this.item});

  final _ProfileActionItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFEFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF5F1EC)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.045),
            offset: const Offset(0, 10),
            blurRadius: 24,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: item.onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: item.iconBackground,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(item.icon, color: item.iconColor, size: 18),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    item.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF303038),
                      fontSize: 13,
                      height: 1.08,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileActionItem {
  const _ProfileActionItem({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.iconBackground,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color iconColor;
  final Color iconBackground;
  final VoidCallback? onTap;
}

class _GeneralSettingsSection extends StatefulWidget {
  const _GeneralSettingsSection({
    required this.showLogout,
    required this.onLogout,
  });

  final bool showLogout;
  final Future<void> Function() onLogout;

  @override
  State<_GeneralSettingsSection> createState() =>
      _GeneralSettingsSectionState();
}

class _GeneralSettingsSectionState extends State<_GeneralSettingsSection> {
  String _language = 'Tiếng Việt';
  bool _languagePickerOpen = false;

  @override
  Widget build(BuildContext context) {
    const settings = [
      _SettingsItem(
        icon: Icons.translate_rounded,
        label: 'Ngôn ngữ',
        showChevron: true,
      ),
      _SettingsItem(
        icon: Icons.favorite_border_rounded,
        label: 'Địa chỉ đã lưu',
      ),
      _SettingsItem(
        icon: Icons.receipt_long_outlined,
        label: 'Hóa đơn',
      ),
      _SettingsItem(
        icon: Icons.star_border_rounded,
        label: 'Đánh giá ứng dụng',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Cài đặt chung',
          style: TextStyle(
            color: Color(0xFF111827),
            fontSize: 20,
            height: 1.1,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 18),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Column(
              children: [
                for (final item in settings)
                  _SettingsRow(
                    item: item,
                    onTap: item.label == 'Ngôn ngữ'
                        ? () => setState(
                            () => _languagePickerOpen = !_languagePickerOpen,
                          )
                        : null,
                  ),
              ],
            ),
            if (_languagePickerOpen)
              Positioned(
                top: 34,
                right: 0,
                child: _LanguagePickerReveal(
                  child: _InlineLanguagePicker(
                    selectedLanguage: _language,
                    onSelected: _selectLanguage,
                  ),
                ),
              ),
          ],
        ),
        if (widget.showLogout) ...[
          const SizedBox(height: 18),
          Center(
            child: TextButton.icon(
              onPressed: widget.onLogout,
              icon: const Icon(
                Icons.logout_rounded,
                color: Color(0xFF111827),
                size: 24,
              ),
              label: const Text(
                'Đăng xuất',
                style: TextStyle(
                  color: Color(0xFF111827),
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF111827),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  void _selectLanguage(String language) {
    setState(() {
      _language = language;
      _languagePickerOpen = false;
    });
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({required this.item, this.onTap});

  final _SettingsItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11),
        child: Row(
          children: [
            SizedBox(
              width: 32,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Icon(
                  item.icon,
                  color: const Color(0xFF7A8588),
                  size: 22,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                item.label,
                style: const TextStyle(
                  color: Color(0xFF3F4248),
                  fontSize: 15,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (item.showChevron)
              const Icon(
                Icons.chevron_right_rounded,
                color: Color(0xFF9AA1A5),
                size: 22,
              ),
          ],
        ),
      ),
    );
  }
}

class _SettingsItem {
  const _SettingsItem({
    required this.icon,
    required this.label,
    this.showChevron = false,
  });

  final IconData icon;
  final String label;
  final bool showChevron;
}

class _LanguagePickerReveal extends StatelessWidget {
  const _LanguagePickerReveal({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 170),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.scale(
            scale: 0.96 + (value * 0.04),
            alignment: Alignment.topRight,
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

class _InlineLanguagePicker extends StatelessWidget {
  const _InlineLanguagePicker({
    required this.selectedLanguage,
    required this.onSelected,
  });

  final String selectedLanguage;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          top: -4,
          right: 20,
          child: Transform.rotate(
            angle: 0.78539816339,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFFFFFEFC),
                border: Border.all(color: const Color(0xFFF0ECE8)),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ),
        Container(
          width: 150,
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 5),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFEFC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFF0ECE8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                offset: const Offset(0, 8),
                blurRadius: 18,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _LanguageOption(
                label: 'Tiếng Việt',
                selected: selectedLanguage == 'Tiếng Việt',
                onTap: () => onSelected('Tiếng Việt'),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Divider(
                  height: 4,
                  thickness: 1,
                  color: Color(0xFFF1EFEC),
                ),
              ),
              _LanguageOption(
                label: 'English',
                selected: selectedLanguage == 'English',
                onTap: () => onSelected('English'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LanguageOption extends StatelessWidget {
  const _LanguageOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? HomeColors.brand.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? HomeColors.brand : const Color(0xFF3F4248),
                  fontSize: 13.5,
                  height: 1.1,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                ),
              ),
            ),
            if (selected)
              const Icon(
                Icons.check_rounded,
                color: HomeColors.brand,
                size: 16,
              ),
          ],
        ),
      ),
    );
  }
}

class _LoginPromptCard extends StatelessWidget {
  const _LoginPromptCard({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF4F4F4)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            offset: const Offset(2, 4),
            blurRadius: 14,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bạn chưa đăng nhập',
            style: TextStyle(
              color: Colors.black,
              fontSize: 19,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Đăng nhập ngay để quản lý tài khoản, xem đánh giá đã lưu và tiếp tục các hoạt động TrustBite.',
            style: TextStyle(
              color: HomeColors.muted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              onPressed: onLogin,
              style: FilledButton.styleFrom(
                backgroundColor: HomeColors.brand,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'Đăng nhập ngay',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
