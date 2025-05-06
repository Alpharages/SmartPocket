import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CircleAvatar(
              radius: 50,
              child: Icon(
                Icons.person,
                size: 50,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Email',
              style: TextStyle(
                fontSize: 16,
                color: AppTheme.textLightColor,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              user?.email ?? 'Not signed in',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Settings and preferences coming soon...',
              style: TextStyle(
                fontSize: 16,
                color: AppTheme.textLightColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
} 