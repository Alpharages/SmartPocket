import 'package:cloud_firestore/cloud_firestore.dart';

class TransactionModel {
  final String id;
  final double amount;
  final String category;
  final DateTime date;
  final String userId;
  final String type;

  TransactionModel({
    required this.id,
    required this.amount,
    required this.category,
    required this.date,
    required this.userId,
    required this.type,
  });

  factory TransactionModel.fromMap(String id, Map<String, dynamic> map) {
    return TransactionModel(
      id: id,
      amount: (map['amount'] as num).toDouble(),
      category: map['category'] as String,
      date: (map['date'] as Timestamp).toDate(),
      userId: map['userId'] as String,
      type: map['type'] as String,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'amount': amount,
      'category': category,
      'date': Timestamp.fromDate(date),
      'userId': userId,
      'type': type,
    };
  }
} 