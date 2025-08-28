import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:smart_pocket/models/loan.dart';
import 'package:smart_pocket/models/repayment.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;
import 'package:smart_pocket/services/notification_service.dart';

class LoanService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final _notificationService = NotificationService();

  // Create a new loan
  Future<void> createLoan(Loan loan) async {
    try {
      print('Creating loan: ${loan.id}');
      await _firestore.collection('loans').doc(loan.id).set(loan.toMap());
      
      print('Scheduling reminders for ${loan.repayments.length} repayments');
      for (var repayment in loan.repayments) {
        print('Scheduling reminder for repayment: ${repayment.id}');
        print('Due date: ${repayment.dueDate}');
        print('Amount: ${repayment.amount}');
        
        await _notificationService.scheduleRepaymentReminder(
          loanId: loan.id,
          personName: loan.personName,
          amount: repayment.amount,
          dueDate: repayment.dueDate,
        );
      }
      print('All reminders scheduled successfully');
    } catch (e) {
      print('Failed to create loan: $e');
      throw Exception('Failed to create loan: $e');
    }
  }

  // Get all loans for the current user
  Stream<List<Loan>> getLoans() {
    final userId = _auth.currentUser?.uid;
    if (userId == null) throw Exception('User not authenticated');

    return _firestore
        .collection('loans')
        .where('userId', isEqualTo: userId)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) => Loan.fromMap(doc.id, doc.data()))
          .toList();
    });
  }

  // Update loan status
  Future<void> updateLoanStatus(String loanId, LoanStatus status) async {
    try {
      await _firestore
          .collection('loans')
          .doc(loanId)
          .update({'status': status.toString()});
    } catch (e) {
      throw Exception('Failed to update loan status: $e');
    }
  }

  // Add a repayment
  Future<void> addRepayment(String loanId, Repayment repayment) async {
    try {
      final loanRef = _firestore.collection('loans').doc(loanId);
      final loanDoc = await loanRef.get();
      
      if (!loanDoc.exists) {
        throw Exception('Loan not found');
      }

      final loan = Loan.fromMap(loanId, loanDoc.data()!);
      final updatedRepayments = [...loan.repayments, repayment];
      
      // Update remaining amount
      final newRemainingAmount = loan.remainingAmount - repayment.amount;
      
      // Update loan status if fully paid
      final newStatus = newRemainingAmount <= 0 
          ? LoanStatus.completed 
          : loan.status;

      await loanRef.update({
        'repayments': updatedRepayments.map((r) => r.toMap()).toList(),
        'remainingAmount': newRemainingAmount,
        'status': newStatus.toString(),
      });
    } catch (e) {
      throw Exception('Failed to add repayment: $e');
    }
  }

  // Generate repayment schedule
  List<Repayment> generateRepaymentSchedule({
    required double totalAmount,
    required double repaymentAmount,
    required RepaymentFrequency frequency,
    required DateTime startDate,
  }) {
    final repayments = <Repayment>[];
    var remainingAmount = totalAmount;
    var currentDate = startDate;

    while (remainingAmount > 0) {
      final amount = remainingAmount < repaymentAmount 
          ? remainingAmount 
          : repaymentAmount;
      
      repayments.add(Repayment(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        amount: amount,
        dueDate: currentDate,
        status: RepaymentStatus.pending,
      ));

      remainingAmount -= amount;

      switch (frequency) {
        case RepaymentFrequency.daily:
          currentDate = currentDate.add(const Duration(days: 1));
          break;
        case RepaymentFrequency.weekly:
          currentDate = currentDate.add(const Duration(days: 7));
          break;
        case RepaymentFrequency.monthly:
          currentDate = DateTime(
            currentDate.year,
            currentDate.month + 1,
            currentDate.day,
          );
          break;
        case RepaymentFrequency.quarterly:
          currentDate = DateTime(
            currentDate.year,
            currentDate.month + 3,
            currentDate.day,
          );
          break;
        case RepaymentFrequency.yearly:
          currentDate = DateTime(
            currentDate.year + 1,
            currentDate.month,
            currentDate.day,
          );
          break;
      }
    }

    return repayments;
  }

  Future<void> checkUpcomingRepayments() async {
    final now = DateTime.now();
    final threeDaysFromNow = now.add(const Duration(days: 3));

    final loans = await _firestore
        .collection('loans')
        .where('userId', isEqualTo: _auth.currentUser?.uid)
        .get();

    for (var loanDoc in loans.docs) {
      final loan = Loan.fromMap(loanDoc.id, loanDoc.data());
      
      for (var repayment in loan.repayments) {
        if (repayment.status == RepaymentStatus.pending &&
            repayment.dueDate.isAfter(now) &&
            repayment.dueDate.isBefore(threeDaysFromNow)) {
          // TODO: Implement notification system
          // For now, we'll just log the reminder
          print('Reminder: Repayment of \$${repayment.amount} due on ${repayment.dueDate}');
        }
      }
    }
  }

  // Update repayment status
  Future<void> updateRepaymentStatus(String loanId, String repaymentId, RepaymentStatus newStatus) async {
    try {
      final loanRef = _firestore.collection('loans').doc(loanId);
      final loanDoc = await loanRef.get();
      
      if (!loanDoc.exists) {
        throw Exception('Loan not found');
      }

      final loan = Loan.fromMap(loanId, loanDoc.data()!);
      final updatedRepayments = loan.repayments.map((repayment) {
        if (repayment.id == repaymentId) {
          // If payment is completed, cancel the reminder
          if (newStatus == RepaymentStatus.completed) {
            _notificationService.cancelRepaymentReminder(loanId);
          }
          
          return Repayment(
            id: repayment.id,
            amount: repayment.amount,
            dueDate: repayment.dueDate,
            paidDate: newStatus == RepaymentStatus.completed ? DateTime.now() : null,
            status: newStatus,
            notes: repayment.notes,
          );
        }
        return repayment;
      }).toList();

      // Update remaining amount if payment is completed
      double newRemainingAmount = loan.remainingAmount;
      if (newStatus == RepaymentStatus.completed) {
        final repayment = loan.repayments.firstWhere((r) => r.id == repaymentId);
        newRemainingAmount -= repayment.amount;
      }

      // Update loan status if fully paid
      final newLoanStatus = newRemainingAmount <= 0 
          ? LoanStatus.completed 
          : loan.status;

      await loanRef.update({
        'repayments': updatedRepayments.map((r) => r.toMap()).toList(),
        'remainingAmount': newRemainingAmount,
        'status': newLoanStatus.toString(),
      });
    } catch (e) {
      throw Exception('Failed to update repayment status: $e');
    }
  }

  Future<void> testNotification() async {
    try {
      print('Testing notification service...');
      await _notificationService.scheduleRepaymentReminder(
        loanId: 'test_${DateTime.now().millisecondsSinceEpoch}',
        personName: 'Test Person',
        amount: 100.0,
        dueDate: DateTime.now().add(const Duration(minutes: 1)), 
      );
      print('Test notification scheduled successfully');
    } catch (e) {
      print('Error testing notification: $e');
    }
  }
} 