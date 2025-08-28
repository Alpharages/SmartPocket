import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:smart_pocket/models/repayment.dart';

enum LoanType {
  borrow,
  lend,
}

enum LoanStatus {
  active,
  completed,
  overdue,
  defaulted,
}

enum RepaymentFrequency {
  daily,
  weekly,
  monthly,
  quarterly,
  yearly,
}

class Loan {
  final String id;
  final String userId;
  final String personName;
  final double amount;
  final double remainingAmount;
  final LoanType type;
  final LoanStatus status;
  final DateTime startDate;
  final DateTime? endDate;
  final RepaymentFrequency frequency;
  final double repaymentAmount;
  final String description;
  final List<Repayment> repayments;

  Loan({
    required this.id,
    required this.userId,
    required this.personName,
    required this.amount,
    required this.remainingAmount,
    required this.type,
    required this.status,
    required this.startDate,
    this.endDate,
    required this.frequency,
    required this.repaymentAmount,
    required this.description,
    required this.repayments,
  });

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'personName': personName,
      'amount': amount,
      'remainingAmount': remainingAmount,
      'type': type.toString(),
      'status': status.toString(),
      'startDate': Timestamp.fromDate(startDate),
      'endDate': endDate != null ? Timestamp.fromDate(endDate!) : null,
      'frequency': frequency.toString(),
      'repaymentAmount': repaymentAmount,
      'description': description,
      'repayments': repayments.map((r) => r.toMap()).toList(),
    };
  }

  factory Loan.fromMap(String id, Map<String, dynamic> map) {
    return Loan(
      id: id,
      userId: map['userId'] ?? '',
      personName: map['personName'] ?? '',
      amount: (map['amount'] ?? 0.0).toDouble(),
      remainingAmount: (map['remainingAmount'] ?? 0.0).toDouble(),
      type: LoanType.values.firstWhere(
        (e) => e.toString() == map['type'],
        orElse: () => LoanType.borrow,
      ),
      status: LoanStatus.values.firstWhere(
        (e) => e.toString() == map['status'],
        orElse: () => LoanStatus.active,
      ),
      startDate: (map['startDate'] as Timestamp).toDate(),
      endDate: map['endDate'] != null ? (map['endDate'] as Timestamp).toDate() : null,
      frequency: RepaymentFrequency.values.firstWhere(
        (e) => e.toString() == map['frequency'],
        orElse: () => RepaymentFrequency.monthly,
      ),
      repaymentAmount: (map['repaymentAmount'] ?? 0.0).toDouble(),
      description: map['description'] ?? '',
      repayments: (map['repayments'] as List<dynamic>?)
              ?.map((r) => Repayment.fromMap(r as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
} 