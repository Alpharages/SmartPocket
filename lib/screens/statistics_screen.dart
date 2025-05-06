import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart' as firestore;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../models/transaction.dart';
import '../theme/app_theme.dart';

class StatisticsScreen extends StatefulWidget {
  const StatisticsScreen({Key? key}) : super(key: key);

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  String _selectedPeriod = 'This Month';
  final List<String> _periods = ['This Week', 'This Month', 'This Year', 'All Time'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Statistics'),
        actions: [
          DropdownButton<String>(
            value: _selectedPeriod,
            underline: const SizedBox(),
            items: _periods.map((period) {
              return DropdownMenuItem(
                value: period,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(period),
                ),
              );
            }).toList(),
            onChanged: (value) {
              if (value != null) {
                setState(() {
                  _selectedPeriod = value;
                });
              }
            },
          ),
        ],
      ),
      body: StreamBuilder<firestore.QuerySnapshot>(
        stream: firestore.FirebaseFirestore.instance
            .collection('transactions')
            .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
            .snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final transactions = snapshot.data?.docs.map((doc) {
            return Transaction.fromMap(doc.id, doc.data() as Map<String, dynamic>);
          }).toList() ?? [];

          if (transactions.isEmpty) {
            return const Center(
              child: Text('No transactions yet'),
            );
          }

          // Filter transactions based on selected period
          final filteredTransactions = _filterTransactionsByPeriod(transactions);

          // Calculate totals
          final totalIncome = _calculateTotalIncome(filteredTransactions);
          final totalExpense = _calculateTotalExpense(filteredTransactions);
          final balance = totalIncome - totalExpense;

          // Get category-wise expenses
          final categoryExpenses = _getCategoryExpenses(filteredTransactions);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryCards(totalIncome, totalExpense, balance),
                const SizedBox(height: 24),
                _buildExpenseChart(categoryExpenses),
                const SizedBox(height: 24),
                _buildRecentTransactions(filteredTransactions),
              ],
            ),
          );
        },
      ),
    );
  }

  List<Transaction> _filterTransactionsByPeriod(List<Transaction> transactions) {
    final now = DateTime.now();
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfMonth = DateTime(now.year, now.month, 1);
    final startOfYear = DateTime(now.year, 1, 1);

    switch (_selectedPeriod) {
      case 'This Week':
        return transactions.where((t) => t.date.isAfter(startOfWeek)).toList();
      case 'This Month':
        return transactions.where((t) => t.date.isAfter(startOfMonth)).toList();
      case 'This Year':
        return transactions.where((t) => t.date.isAfter(startOfYear)).toList();
      default:
        return transactions;
    }
  }

  double _calculateTotalIncome(List<Transaction> transactions) {
    return transactions
        .where((t) => t.type == TransactionType.income)
        .fold(0, (sum, t) => sum + t.amount);
  }

  double _calculateTotalExpense(List<Transaction> transactions) {
    return transactions
        .where((t) => t.type == TransactionType.expense)
        .fold(0, (sum, t) => sum + t.amount);
  }

  Map<String, double> _getCategoryExpenses(List<Transaction> transactions) {
    final expenses = transactions.where((t) => t.type == TransactionType.expense);
    final categoryExpenses = <String, double>{};

    for (final expense in expenses) {
      categoryExpenses[expense.category] =
          (categoryExpenses[expense.category] ?? 0) + expense.amount;
    }

    return categoryExpenses;
  }

  Widget _buildSummaryCards(double income, double expense, double balance) {
    return Row(
      children: [
        Expanded(
          child: _buildSummaryCard(
            'Income',
            income,
            Colors.green,
            Icons.arrow_upward,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildSummaryCard(
            'Expense',
            expense,
            Colors.red,
            Icons.arrow_downward,
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildSummaryCard(
            'Balance',
            balance,
            balance >= 0 ? Colors.blue : Colors.orange,
            Icons.account_balance_wallet,
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(
    String title,
    double amount,
    Color color,
    IconData icon,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                color: AppTheme.textLightColor,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '\$${amount.toStringAsFixed(2)}',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpenseChart(Map<String, double> categoryExpenses) {
    if (categoryExpenses.isEmpty) {
      return const SizedBox.shrink();
    }

    final total = categoryExpenses.values.fold(0.0, (sum, amount) => sum + amount);
    final sections = categoryExpenses.entries.map((entry) {
      final percentage = (entry.value / total * 100).round();
      return PieChartSectionData(
        value: entry.value,
        title: '$percentage%',
        radius: 100,
        titleStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      );
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Expenses by Category',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 200,
          child: PieChart(
            PieChartData(
              sections: sections,
              sectionsSpace: 2,
              centerSpaceRadius: 40,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: categoryExpenses.entries.map((entry) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 12,
                  height: 12,
                  color: Colors.primaries[
                      categoryExpenses.keys.toList().indexOf(entry.key) %
                          Colors.primaries.length],
                ),
                const SizedBox(width: 4),
                Text(entry.key),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildRecentTransactions(List<Transaction> transactions) {
    final recentTransactions = transactions
        .take(5)
        .toList()
      ..sort((a, b) => b.date.compareTo(a.date));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Recent Transactions',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        ...recentTransactions.map((transaction) {
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: transaction.type == TransactionType.income
                    ? Colors.green
                    : Colors.red,
                child: Icon(
                  transaction.type == TransactionType.income
                      ? Icons.arrow_upward
                      : Icons.arrow_downward,
                  color: Colors.white,
                ),
              ),
              title: Text(transaction.description),
              subtitle: Text(
                '${transaction.category} • ${DateFormat('MMM d, y').format(transaction.date)}',
              ),
              trailing: Text(
                '${transaction.type == TransactionType.income ? '+' : '-'}\$${transaction.amount.toStringAsFixed(2)}',
                style: TextStyle(
                  color: transaction.type == TransactionType.income
                      ? Colors.green
                      : Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        }).toList(),
      ],
    );
  }
} 