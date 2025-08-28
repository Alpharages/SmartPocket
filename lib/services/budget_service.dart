import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:smart_pocket/models/transaction.dart';
import '../models/transaction_model.dart';
import 'package:smart_pocket/models/budget.dart';

class BudgetService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // Get all active budgets for the current user
  Stream<List<Budget>> getBudgets() {
    final user = _auth.currentUser;
    if (user == null) return Stream.value([]);

    return _firestore
        .collection('budgets')
        .where('userId', isEqualTo: user.uid)
        .where('isActive', isEqualTo: true)
        .snapshots()
        .map((snapshot) => snapshot.docs.map((doc) => Budget.fromMap(doc.id, doc.data())).toList());
  }

  // Add a new budget
  Future<void> addBudget(Budget budget) async {
    await _firestore.collection('budgets').doc(budget.id).set(budget.toMap());
  }

  Future<void> updateBudgetForTransaction(transaction) async {
    if (transaction.type != TransactionType.expense) return;

    final user = _auth.currentUser;
    if (user == null) return;

    // Get all active budgets for the transaction category
    final budgets = await _firestore
        .collection('budgets')
        .where('userId', isEqualTo: user.uid)
        .where('category', isEqualTo: transaction.category)
        .where('isActive', isEqualTo: true)
        .get();

    for (var doc in budgets.docs) {
      final budget = Budget.fromMap(doc.id, doc.data());

      if (transaction.date.isAfter(budget.startDate) && transaction.date.isBefore(budget.endDate)) {
        await doc.reference.update({
          'spent': FieldValue.increment(transaction.amount),
        });
      }
    }
  }

  Future<void> removeTransactionFromBudget(transaction) async {
    if (transaction.type != TransactionType.expense) return;

    final user = _auth.currentUser;
    if (user == null) return;

    final budgets = await _firestore
        .collection('budgets')
        .where('userId', isEqualTo: user.uid)
        .where('category', isEqualTo: transaction.category)
        .where('isActive', isEqualTo: true)
        .get();

    for (var doc in budgets.docs) {
      final budget = Budget.fromMap(doc.id, doc.data());

      if (transaction.date.isAfter(budget.startDate) && transaction.date.isBefore(budget.endDate)) {
        await doc.reference.update({
          'spent': FieldValue.increment(-transaction.amount),
        });
      }
    }
  }

  // Get budget status for a category
  Future<Budget?> getBudgetForCategory(String category) async {
    final user = _auth.currentUser;
    if (user == null) return null;

    final now = DateTime.now();
    final budgets = await _firestore
        .collection('budgets')
        .where('userId', isEqualTo: user.uid)
        .where('category', isEqualTo: category)
        .where('isActive', isEqualTo: true)
        .get();

    for (var doc in budgets.docs) {
      final budget = Budget.fromMap(doc.id, doc.data());
      if (now.isAfter(budget.startDate) && now.isBefore(budget.endDate)) {
        return budget;
      }
    }
    return null;
  }

  // Update budget spending
  Future<void> updateBudgetSpending(String category, double amount) async {
    final user = _auth.currentUser;
    if (user == null) return;

    final budgets = await _firestore
        .collection('budgets')
        .where('userId', isEqualTo: user.uid)
        .where('category', isEqualTo: category)
        .where('isActive', isEqualTo: true)
        .get();

    for (var doc in budgets.docs) {
      final budget = Budget.fromMap(doc.id, doc.data());
      if (!budget.isExpired) {
        await doc.reference.update({
          'spent': FieldValue.increment(amount),
        });
      }
    }
  }

  // Delete a budget
  Future<void> deleteBudget(String budgetId) async {
    await _firestore.collection('budgets').doc(budgetId).delete();
  }

  // Archive a budget
  Future<void> archiveBudget(String budgetId) async {
    await _firestore.collection('budgets').doc(budgetId).update({
      'isActive': false,
    });
  }

  // Update budget amount
  Future<void> updateBudgetAmount(String budgetId, double newAmount) async {
    await _firestore.collection('budgets').doc(budgetId).update({
      'amount': newAmount,
    });
  }

  // Reset budget spending (for new period)
  Future<void> resetBudgetSpending(String budgetId) async {
    await _firestore.collection('budgets').doc(budgetId).update({
      'spent': 0,
      'startDate': Timestamp.fromDate(DateTime.now()),
      'endDate': Timestamp.fromDate(DateTime.now().add(const Duration(days: 30))),
    });
  }

  Future<List<TransactionModel>> getTransactions() async {
    try {
      final userId = _auth.currentUser?.uid;
      if (userId == null) throw Exception('User not authenticated');

      final snapshot = await _firestore.collection('transactions').where('userId', isEqualTo: userId).get();

      return snapshot.docs.map((doc) => TransactionModel.fromMap(doc.id, doc.data())).toList();
    } catch (e) {
      print('Error getting transactions: $e');
      return [];
    }
  }

  Future<void> addTransactionToBudget(transaction) async {
    // ... implementation
  }
}
