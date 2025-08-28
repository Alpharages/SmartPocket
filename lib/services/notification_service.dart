import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;
import 'package:flutter/foundation.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    try {
      print('Initializing notification service...');
      tz.initializeTimeZones();

      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _notifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: _onNotificationTap,
      );
      print('Notification service initialized successfully');

      // Create notification channel for Android
      if (Platform.isAndroid) {
        print('Creating Android notification channel...');
        await _notifications
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.createNotificationChannel(
              const AndroidNotificationChannel(
                'repayment_reminders',
                'Repayment Reminders',
                description: 'Notifications for upcoming loan repayments',
                importance: Importance.high,
                // priority: Priority.high,
              ),
            );
        print('Android notification channel created successfully');
      }
    } catch (e) {
      print('Error initializing notification service: $e');
    }
  }

  Future<void> _onNotificationTap(NotificationResponse response) async {
    print('Notification tapped: ${response.payload}');
  }

  Future<void> scheduleRepaymentReminder({
    required String loanId,
    required String personName,
    required double amount,
    required DateTime dueDate,
  }) async {
    try {
      print('Scheduling reminder for loan: $loanId');
      print('Due date: $dueDate');

      // Schedule reminder 3 days before due date
      final reminderDate = dueDate.subtract(const Duration(days: 3));
      print('Reminder date: $reminderDate');

      // Don't schedule if the reminder date is in the past
      if (reminderDate.isBefore(DateTime.now())) {
        print('Reminder date is in the past, skipping notification');
        return;
      }

      final scheduled = await _notifications.zonedSchedule(
        loanId.hashCode,
        'Repayment Reminder',
        'You have a payment of \$${amount.toStringAsFixed(2)} due to $personName on ${dueDate.toString().split(' ')[0]}',
        tz.TZDateTime.from(reminderDate, tz.local),
        NotificationDetails(
          android: AndroidNotificationDetails(
            'repayment_reminders',
            'Repayment Reminders',
            channelDescription: 'Notifications for upcoming loan repayments',
            importance: Importance.high,
            priority: Priority.high,
            enableVibration: true,
            playSound: true,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        payload: loanId,
      );

      // if (scheduled) {
      //   print('Successfully scheduled reminder for loan $loanId');
      // } else {
      //   print('Failed to schedule reminder for loan $loanId');
      // }
    } catch (e) {
      print('Error scheduling reminder: $e');
    }
  }

  Future<void> cancelRepaymentReminder(String loanId) async {
    await _notifications.cancel(loanId.hashCode);
  }

  Future<void> cancelAllReminders() async {
    await _notifications.cancelAll();
  }
}
