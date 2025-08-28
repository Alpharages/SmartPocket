import 'package:cloud_firestore/cloud_firestore.dart';

class Budget {
  final String id;
  final String userId;
  final String category;
  final double amount;
  final double spent;
  final DateTime startDate;
  final DateTime endDate;
  final bool isActive;
  final String period; // 'monthly', 'weekly', 'yearly'

  Budget({
    required this.id,
    required this.userId,
    required this.category,
    required this.amount,
    required this.spent,
    required this.startDate,
    required this.endDate,
    this.isActive = true,
    this.period = 'monthly',
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'category': category,
      'amount': amount,
      'spent': spent,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': Timestamp.fromDate(endDate),
      'isActive': isActive,
      'period': period,
    };
  }

  factory Budget.fromMap(String id, Map<String, dynamic> map) {
    return Budget(
      id: id,
      userId: map['userId'] ?? '',
      category: map['category'] ?? '',
      amount: (map['amount'] ?? 0.0).toDouble(),
      spent: (map['spent'] ?? 0.0).toDouble(),
      startDate: (map['startDate'] as Timestamp).toDate(),
      endDate: (map['endDate'] as Timestamp).toDate(),
      isActive: map['isActive'] ?? true,
      period: map['period'] ?? 'monthly',
    );
  }

  double get remaining => amount - spent;
  double get progress => (spent / amount).clamp(0.0, 1.0);
  bool get isOverBudget => spent > amount;
  bool get isExpired => DateTime.now().isAfter(endDate);

  Budget copyWith({
    String? id,
    String? userId,
    String? category,
    double? amount,
    double? spent,
    DateTime? startDate,
    DateTime? endDate,
    bool? isActive,
    String? period,
  }) {
    return Budget(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      category: category ?? this.category,
      amount: amount ?? this.amount,
      spent: spent ?? this.spent,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      isActive: isActive ?? this.isActive,
      period: period ?? this.period,
    );
  }
} 