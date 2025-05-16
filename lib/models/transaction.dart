import 'package:cloud_firestore/cloud_firestore.dart';

enum TransactionType {
  income,
  expense,
}

enum TransactionFrequency {
  oneTime,
  daily,
  weekly,
  monthly,
  yearly,
}

class Transaction1 {
  final String id;
  final String userId;
  final double amount;
  final String description;
  final String category;
  final TransactionType type;
  final DateTime date;
  final TransactionFrequency frequency;
  final bool isRecurring;

  Transaction1({
    required this.id,
    required this.userId,
    required this.amount,
    required this.description,
    required this.category,
    required this.type,
    required this.date,
    required this.frequency,
    required this.isRecurring,
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'amount': amount,
      'description': description,
      'category': category,
      'type': type.toString(),
      'date': Timestamp.fromDate(date),
      'frequency': frequency.toString(),
      'isRecurring': isRecurring,
    };
  }

  factory Transaction1.fromMap(String id, Map<String, dynamic> map) {
    return Transaction1(
      id: id,
      userId: map['userId'] as String,
      amount: (map['amount'] as num).toDouble(),
      description: map['description'] as String,
      category: map['category'] as String,
      type: TransactionType.values.firstWhere(
        (e) => e.toString() == map['type'],
        orElse: () => TransactionType.expense,
      ),
      date: (map['date'] as Timestamp).toDate(),
      frequency: TransactionFrequency.values.firstWhere(
        (e) => e.toString() == map['frequency'],
        orElse: () => TransactionFrequency.oneTime,
      ),
      isRecurring: map['isRecurring'] as bool? ?? false,
    );
  }
}