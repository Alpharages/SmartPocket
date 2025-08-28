import 'package:cloud_firestore/cloud_firestore.dart';

enum RepaymentStatus {
  pending,
  completed,
  overdue,
  missed,
}

class Repayment {
  final String id;
  final double amount;
  final DateTime dueDate;
  final DateTime? paidDate;
  final RepaymentStatus status;
  final String? notes;

  Repayment({
    required this.id,
    required this.amount,
    required this.dueDate,
    this.paidDate,
    required this.status,
    this.notes,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'amount': amount,
      'dueDate': Timestamp.fromDate(dueDate),
      'paidDate': paidDate != null ? Timestamp.fromDate(paidDate!) : null,
      'status': status.toString(),
      'notes': notes,
    };
  }

  factory Repayment.fromMap(Map<String, dynamic> map) {
    return Repayment(
      id: map['id'] ?? '',
      amount: (map['amount'] ?? 0.0).toDouble(),
      dueDate: (map['dueDate'] as Timestamp).toDate(),
      paidDate: map['paidDate'] != null ? (map['paidDate'] as Timestamp).toDate() : null,
      status: RepaymentStatus.values.firstWhere(
        (e) => e.toString() == map['status'],
        orElse: () => RepaymentStatus.pending,
      ),
      notes: map['notes'],
    );
  }
} 