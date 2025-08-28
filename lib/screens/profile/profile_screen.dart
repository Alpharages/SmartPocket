import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../theme/app_theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      setState(() {
        _nameController.text = user.displayName ?? '';
        _emailController.text = user.email ?? '';
      });
    }
  }

  Future<void> _updateProfile() async {
    print('Starting profile update...');
    if (!_formKey.currentState!.validate()) {
      print('Form validation failed');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        print('No user is currently signed in');
        throw Exception('No user is currently signed in');
      }
      print('Current user email: ${user.email}');

      if (user.displayName != _nameController.text) {
        print('Updating display name from ${user.displayName} to ${_nameController.text}');
        await user.updateDisplayName(_nameController.text);
        print('Display name updated successfully');
      }

      // Handle email change
      if (_emailController.text != user.email) {
        print('Email change detected. New email: ${_emailController.text}');
        // Validate email format
        if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(_emailController.text)) {
          print('Invalid email format: ${_emailController.text}');
          throw Exception('Please enter a valid email address');
        }

        // Show dialog to get current password for reauthentication
        print('Showing reauthentication dialog...');
        final currentPassword = await _showReauthDialog();
        if (currentPassword == null) {
          print('Reauthentication cancelled by user');
          throw Exception('Reauthentication required to change email');
        }
        print('Reauthentication password received');

        try {
          // Reauthenticate user
          print('Attempting to reauthenticate user...');
          final credential = EmailAuthProvider.credential(
            email: user.email!,
            password: currentPassword,
          );

          // First reauthenticate
          await user.reauthenticateWithCredential(credential);
          print('Reauthentication successful');

          // Send email verification
          print('Sending email verification to: ${_emailController.text}');
          await user.verifyBeforeUpdateEmail(_emailController.text);
          print('Verification email sent successfully');

          // Show success message
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Verification email sent. Please check your new email address to complete the change.'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 5),
              ),
            );
            setState(() {
              _isEditing = false;
              _currentPasswordController.clear();
              _newPasswordController.clear();
            });
          }
        } on FirebaseAuthException catch (e) {
          print('FirebaseAuthException during email update: ${e.code} - ${e.message}');
          String message = 'An error occurred';
          switch (e.code) {
            case 'wrong-password':
              message = 'Current password is incorrect';
              break;
            case 'email-already-in-use':
              message = 'This email is already in use by another account';
              break;
            case 'invalid-email':
              message = 'Please enter a valid email address';
              break;
            case 'requires-recent-login':
              message = 'Please log out and log in again to change your email';
              break;
            case 'user-mismatch':
              message = 'The provided credentials do not match the current user';
              break;
            case 'user-not-found':
              message = 'User not found';
              break;
            case 'invalid-credential':
              message = 'Invalid credentials';
              break;
            case 'operation-not-allowed':
              message = 'Email/password authentication is not enabled. Please contact support.';
              break;
            case 'too-many-requests':
              message = 'Too many attempts. Please try again later';
              break;
          }
          print('Throwing exception with message: $message');
          throw Exception(message);
        }
      }

      // Handle password change
      if (_newPasswordController.text.isNotEmpty) {
        print('Password change detected');
        // Validate password strength
        if (_newPasswordController.text.length < 8) {
          throw Exception('Password must be at least 8 characters long');
        }
        if (!RegExp(r'[A-Z]').hasMatch(_newPasswordController.text)) {
          throw Exception('Password must contain at least one uppercase letter');
        }
        if (!RegExp(r'[a-z]').hasMatch(_newPasswordController.text)) {
          throw Exception('Password must contain at least one lowercase letter');
        }
        if (!RegExp(r'[0-9]').hasMatch(_newPasswordController.text)) {
          throw Exception('Password must contain at least one number');
        }
        if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(_newPasswordController.text)) {
          throw Exception('Password must contain at least one special character');
        }

        // If we haven't already reauthenticated for email change
        if (_emailController.text == user.email) {
          final currentPassword = await _showReauthDialog();
          if (currentPassword == null) {
            throw Exception('Reauthentication required to change password');
          }

          final credential = EmailAuthProvider.credential(
            email: user.email!,
            password: currentPassword,
          );

          try {
            await user.reauthenticateWithCredential(credential);
          } on FirebaseAuthException catch (e) {
            if (e.code == 'wrong-password') {
              throw Exception('Current password is incorrect');
            } else if (e.code == 'requires-recent-login') {
              throw Exception('Please log out and log in again to change your password');
            }
            rethrow;
          }
        }

        try {
          await user.updatePassword(_newPasswordController.text);
        } on FirebaseAuthException catch (e) {
          if (e.code == 'weak-password') {
            throw Exception('The password is too weak. Please use a stronger password');
          }
          rethrow;
        }
      }

      if (mounted) {
        print('Profile update completed successfully');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully'),
            backgroundColor: Colors.green,
          ),
        );
        setState(() {
          _isEditing = false;
          _currentPasswordController.clear();
          _newPasswordController.clear();
        });
      }
    } on FirebaseAuthException catch (e) {
      print('FirebaseAuthException in _updateProfile: ${e.code} - ${e.message}');
      String message = 'An error occurred';
      if (e.code == 'requires-recent-login') {
        message = 'Please log out and log in again to update your profile';
      } else if (e.code == 'wrong-password') {
        message = 'Current password is incorrect';
      } else if (e.code == 'email-already-in-use') {
        message = 'Email is already in use';
      } else if (e.code == 'invalid-email') {
        message = 'Invalid email address';
      } else if (e.code == 'weak-password') {
        message = 'The password is too weak';
      } else if (e.code == 'operation-not-allowed') {
        message = 'Email/password authentication is not enabled. Please contact support.';
      }
      print('Showing error message: $message');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('General exception in _updateProfile: $e');
      String message = e.toString();
      if (message.contains('operation-not-allowed')) {
        message = 'Email/password authentication is not enabled. Please contact support.';
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<String?> _showReauthDialog() async {
    print('Showing reauthentication dialog');
    final TextEditingController passwordController = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Reauthentication Required'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Please enter your current password to continue.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                decoration: const InputDecoration(
                  labelText: 'Current Password',
                  border: OutlineInputBorder(),
                ),
                obscureText: true,
                onSubmitted: (value) {
                  print('Password submitted via keyboard: ${value.isNotEmpty ? 'not empty' : 'empty'}');
                  if (value.isNotEmpty) {
                    Navigator.of(context).pop(value);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                print('Reauthentication cancelled');
                Navigator.of(context).pop();
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                print('Confirm button pressed. Password length: ${passwordController.text.length}');
                if (passwordController.text.isNotEmpty) {
                  Navigator.of(context).pop(passwordController.text);
                }
              },
              child: const Text('Confirm'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _logout() async {
    try {
      await FirebaseAuth.instance.signOut();
      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/login');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error logging out: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  Widget _buildProfileHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.primaryColor,
            AppTheme.primaryColor.withOpacity(0.8),
          ],
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Column(
        children: [
          Stack(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const CircleAvatar(
                  radius: 50,
                  backgroundColor: Colors.white,
                  child: Icon(
                    Icons.person,
                    size: 50,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ),
              if (!_isEditing)
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.edit,
                      size: 20,
                      color: AppTheme.primaryColor,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            FirebaseAuth.instance.currentUser?.displayName ?? 'User',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            FirebaseAuth.instance.currentUser?.email ?? '',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileInfo() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildInfoCard(
            title: 'Name',
            value: FirebaseAuth.instance.currentUser?.displayName ?? 'Not set',
            icon: Icons.person_outline,
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            title: 'Email',
            value: FirebaseAuth.instance.currentUser?.email ?? 'Not set',
            icon: Icons.email_outlined,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => setState(() => _isEditing = true),
            icon: const Icon(Icons.edit),
            label: const Text('Edit Profile'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            label: const Text('Logout'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: AppTheme.primaryColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppTheme.textLightColor,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Name',
                prefixIcon: const Icon(Icons.person_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter your name';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: 'Email',
                prefixIcon: const Icon(Icons.email_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter your email';
                }
                if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                  return 'Please enter a valid email';
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            const Text(
              'Change Password',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _currentPasswordController,
              decoration: InputDecoration(
                labelText: 'Current Password',
                prefixIcon: const Icon(Icons.lock_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              obscureText: true,
              validator: (value) {
                if (_newPasswordController.text.isNotEmpty && (value == null || value.isEmpty)) {
                  return 'Please enter your current password';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _newPasswordController,
              decoration: InputDecoration(
                labelText: 'New Password',
                prefixIcon: const Icon(Icons.lock_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              obscureText: true,
              validator: (value) {
                if (value != null && value.isNotEmpty) {
                  if (value.length < 8) {
                    return 'Password must be at least 8 characters long';
                  }
                  if (!RegExp(r'[A-Z]').hasMatch(value)) {
                    return 'Password must contain at least one uppercase letter';
                  }
                  if (!RegExp(r'[a-z]').hasMatch(value)) {
                    return 'Password must contain at least one lowercase letter';
                  }
                  if (!RegExp(r'[0-9]').hasMatch(value)) {
                    return 'Password must contain at least one number';
                  }
                  if (!RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(value)) {
                    return 'Password must contain at least one special character';
                  }
                }
                return null;
              },
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _isEditing = false;
                        _currentPasswordController.clear();
                        _newPasswordController.clear();
                      });
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _updateProfile,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Save Changes'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        elevation: 0,
      ),
      body: Column(
        children: [
          _buildProfileHeader(),
          Expanded(
            child: _isEditing ? _buildEditForm() : _buildProfileInfo(),
          ),
        ],
      ),
    );
  }
}
