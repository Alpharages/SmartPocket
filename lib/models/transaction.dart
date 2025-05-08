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

class Transaction {
  final String id;
  final String userId;
  final double amount;
  final String description;
  final String category;
  final TransactionType type;
  final DateTime date;
  final TransactionFrequency frequency;
  final bool isRecurring;

  Transaction({
    required this.id,
    required this.userId,
    required this.amount,
    required this.description,
    required this.category,
    required this.type,
    required this.date,
    this.frequency = TransactionFrequency.oneTime,
    this.isRecurring = false,
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

  factory Transaction.fromMap(String id, Map<String, dynamic> map) {
    return Transaction(
      id: id,
      userId: map['userId'] ?? '',
      amount: (map['amount'] ?? 0.0).toDouble(),
      description: map['description'] ?? '',
      category: map['category'] ?? '',
      type: TransactionType.values.firstWhere(
        (e) => e.toString() == map['type'],
        orElse: () => TransactionType.expense,
      ),
      date: (map['date'] as Timestamp).toDate(),
      frequency: TransactionFrequency.values.firstWhere(
        (e) => e.toString() == map['frequency'],
        orElse: () => TransactionFrequency.oneTime,
      ),
      isRecurring: map['isRecurring'] ?? false,
    );
  }
}
