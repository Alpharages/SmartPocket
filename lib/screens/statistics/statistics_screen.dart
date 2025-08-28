import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart' as firestore;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../../models/transaction.dart';
import '../../models/budget.dart';
import '../../models/loan.dart';
import '../../theme/app_theme.dart';

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
        automaticallyImplyLeading: false,
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildOverallProgress(),
            const SizedBox(height: 24),
            _buildTransactionStats(),
            const SizedBox(height: 24),
            _buildBudgetStats(),
            const SizedBox(height: 24),
            _buildLoanStats(),
            const SizedBox(height: 24),
            _buildSavingsProgress(),
            const SizedBox(height: 24),
            _buildFinancialHealthScore(),
            const SizedBox(height: 24),
            _buildMonthlyComparison(),
            const SizedBox(height: 24),
            _buildCategoryPerformance(),
          ],
        ),
      ),
    );
  }

  Widget _buildOverallProgress() {
    return StreamBuilder<firestore.QuerySnapshot>(
      stream: firestore.FirebaseFirestore.instance
          .collection('transactions')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final transactions = snapshot.data!.docs.map((doc) {
          return Transaction1.fromMap(doc.id, doc.data() as Map<String, dynamic>);
        }).toList();

        final filteredTransactions = _filterTransactionsByPeriod(transactions);
        final totalIncome = _calculateTotalIncome(filteredTransactions);
        final totalExpense = _calculateTotalExpense(filteredTransactions);
        final balance = totalIncome - totalExpense;
        final savingsRate = totalIncome > 0 ? (balance / totalIncome * 100).toDouble() : 0.0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Overall Financial Progress',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _buildProgressIndicator(
                            'Income',
                            totalIncome,
                            Colors.green,
                            Icons.arrow_upward,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildProgressIndicator(
                            'Expenses',
                            totalExpense,
                            Colors.red,
                            Icons.arrow_downward,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildProgressIndicator(
                            'Savings',
                            balance,
                            balance >= 0 ? Colors.blue : Colors.orange,
                            Icons.savings,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _buildSavingsRateCard(savingsRate),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildProgressIndicator(String label, double amount, Color color, IconData icon) {
    return Column(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(30),
          ),
          child: Icon(icon, color: color, size: 30),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppTheme.textLightColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '\$${amount.toStringAsFixed(2)}',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildSavingsRateCard(double savingsRate) {
    Color rateColor;
    String rateStatus;

    if (savingsRate >= 20) {
      rateColor = Colors.green;
      rateStatus = 'Excellent';
    } else if (savingsRate >= 10) {
      rateColor = Colors.blue;
      rateStatus = 'Good';
    } else if (savingsRate >= 0) {
      rateColor = Colors.orange;
      rateStatus = 'Fair';
    } else {
      rateColor = Colors.red;
      rateStatus = 'Poor';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: rateColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: rateColor.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Savings Rate',
                style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.textLightColor,
                ),
              ),
              Text(
                '$rateStatus',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: rateColor,
                ),
              ),
            ],
          ),
          Text(
            '${savingsRate.toStringAsFixed(1)}%',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: rateColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSavingsProgress() {
    return StreamBuilder<firestore.QuerySnapshot>(
      stream: firestore.FirebaseFirestore.instance
          .collection('savings_goals')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const SizedBox.shrink();
        }

        final goals = snapshot.data!.docs;
        final totalGoals = goals.length;
        final completedGoals = goals.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          final currentAmount = (data['currentAmount'] ?? 0.0).toDouble();
          final targetAmount = (data['targetAmount'] ?? 0.0).toDouble();
          return currentAmount >= targetAmount;
        }).length;

        final completionRate = totalGoals > 0 ? (completedGoals / totalGoals * 100) : 0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Savings Goals Progress',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Goals Completed',
                          style: TextStyle(
                            fontSize: 16,
                            color: AppTheme.textLightColor,
                          ),
                        ),
                        Text(
                          '$completedGoals / $totalGoals',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: completionRate / 100,
                      backgroundColor: Colors.grey[200],
                      valueColor: AlwaysStoppedAnimation<Color>(
                        completionRate >= 80
                            ? Colors.green
                            : completionRate >= 50
                                ? Colors.blue
                                : completionRate >= 20
                                    ? Colors.orange
                                    : Colors.red,
                      ),
                      minHeight: 8,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${completionRate.toStringAsFixed(1)}% Complete',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: completionRate >= 80
                            ? Colors.green
                            : completionRate >= 50
                                ? Colors.blue
                                : completionRate >= 20
                                    ? Colors.orange
                                    : Colors.red,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFinancialHealthScore() {
    return StreamBuilder<firestore.QuerySnapshot>(
      stream: firestore.FirebaseFirestore.instance
          .collection('transactions')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final transactions = snapshot.data!.docs.map((doc) {
          return Transaction1.fromMap(doc.id, doc.data() as Map<String, dynamic>);
        }).toList();

        final filteredTransactions = _filterTransactionsByPeriod(transactions);
        final totalIncome = _calculateTotalIncome(filteredTransactions);
        final totalExpense = _calculateTotalExpense(filteredTransactions);
        final balance = totalIncome - totalExpense;
        final savingsRate = totalIncome > 0 ? (balance / totalIncome * 100) : 0;

        // Calculate financial health score (0-100)
        double healthScore = 0;
        if (totalIncome > 0) {
          // Savings rate component (40 points)
          healthScore += (savingsRate / 20 * 40).clamp(0, 40);

          // Expense control component (30 points)
          final expenseRatio = totalExpense / totalIncome;
          healthScore += ((1 - expenseRatio) * 30).clamp(0, 30);

          // Consistency component (30 points)
          final transactionCount = filteredTransactions.length;
          healthScore += (transactionCount / 10 * 30).clamp(0, 30);
        }

        Color scoreColor;
        String scoreStatus;

        if (healthScore >= 80) {
          scoreColor = Colors.green;
          scoreStatus = 'Excellent';
        } else if (healthScore >= 60) {
          scoreColor = Colors.blue;
          scoreStatus = 'Good';
        } else if (healthScore >= 40) {
          scoreColor = Colors.orange;
          scoreStatus = 'Fair';
        } else {
          scoreColor = Colors.red;
          scoreStatus = 'Poor';
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Financial Health Score',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    SizedBox(
                      height: 120,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox(
                            height: 120,
                            width: 120,
                            child: CircularProgressIndicator(
                              value: healthScore / 100,
                              strokeWidth: 12,
                              backgroundColor: Colors.grey[200],
                              valueColor: AlwaysStoppedAnimation<Color>(scoreColor),
                            ),
                          ),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '${healthScore.toStringAsFixed(0)}',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: scoreColor,
                                ),
                              ),
                              Text(
                                scoreStatus,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: scoreColor,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildScoreMetric('Savings Rate', '${savingsRate.toStringAsFixed(1)}%', Colors.green),
                        _buildScoreMetric(
                            'Expense Control',
                            '${((1 - (totalExpense / (totalIncome > 0 ? totalIncome : 1))) * 100).toStringAsFixed(1)}%',
                            Colors.blue),
                        _buildScoreMetric('Consistency', '${filteredTransactions.length}', Colors.orange),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildScoreMetric(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: AppTheme.textLightColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyComparison() {
    return StreamBuilder<firestore.QuerySnapshot>(
      stream: firestore.FirebaseFirestore.instance
          .collection('transactions')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final transactions = snapshot.data!.docs.map((doc) {
          return Transaction1.fromMap(doc.id, doc.data() as Map<String, dynamic>);
        }).toList();

        // Get last 6 months data
        final now = DateTime.now();
        final monthlyData = <String, Map<String, double>>{};

        for (int i = 5; i >= 0; i--) {
          final month = DateTime(now.year, now.month - i, 1);
          final monthKey = DateFormat('MMM yyyy').format(month);
          monthlyData[monthKey] = {'income': 0, 'expense': 0};
        }

        for (final transaction in transactions) {
          final monthKey = DateFormat('MMM yyyy').format(transaction.date);
          if (monthlyData.containsKey(monthKey)) {
            if (transaction.type == TransactionType.income) {
              monthlyData[monthKey]!['income'] = (monthlyData[monthKey]!['income'] ?? 0) + transaction.amount;
            } else {
              monthlyData[monthKey]!['expense'] = (monthlyData[monthKey]!['expense'] ?? 0) + transaction.amount;
            }
          }
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '6-Month Financial Trend',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  height: 250,
                  child: BarChart(
                    BarChartData(
                      alignment: BarChartAlignment.spaceAround,
                      maxY: monthlyData.values.fold(0.0, (max, data) {
                            final total = (data['income'] ?? 0) + (data['expense'] ?? 0);
                            return total > max ? total : max;
                          }) *
                          1.2,
                      barTouchData: BarTouchData(enabled: false),
                      titlesData: FlTitlesData(
                        show: true,
                        rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (value, meta) {
                              final months = monthlyData.keys.toList();
                              if (value.toInt() >= 0 && value.toInt() < months.length) {
                                return Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    months[value.toInt()],
                                    style: const TextStyle(fontSize: 10),
                                  ),
                                );
                              }
                              return const Text('');
                            },
                          ),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 40,
                            getTitlesWidget: (value, meta) {
                              return Text(
                                '\$${value.toInt()}',
                                style: const TextStyle(fontSize: 10),
                              );
                            },
                          ),
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      barGroups: monthlyData.entries.map((entry) {
                        final index = monthlyData.keys.toList().indexOf(entry.key);
                        return BarChartGroupData(
                          x: index,
                          barRods: [
                            BarChartRodData(
                              toY: entry.value['income'] ?? 0,
                              color: Colors.green,
                              width: 8,
                            ),
                            BarChartRodData(
                              toY: entry.value['expense'] ?? 0,
                              color: Colors.red,
                              width: 8,
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCategoryPerformance() {
    return StreamBuilder<firestore.QuerySnapshot>(
      stream: firestore.FirebaseFirestore.instance
          .collection('transactions')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final transactions = snapshot.data!.docs.map((doc) {
          return Transaction1.fromMap(doc.id, doc.data() as Map<String, dynamic>);
        }).toList();

        final filteredTransactions = _filterTransactionsByPeriod(transactions);
        final categoryExpenses = _getCategoryExpenses(filteredTransactions);
        final categoryIncomes = _getCategoryIncomes(filteredTransactions);

        // Sort expense categories
        final sortedExpenses = categoryExpenses.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

        // Sort income categories
        final sortedIncomes = categoryIncomes.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Category Performance',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const Text(
                      'Top Expense Categories',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...sortedExpenses.take(5).map((entry) => _buildCategoryRow(entry.key, entry.value, Colors.red)),
                    const SizedBox(height: 20),
                    const Text(
                      'Top Income Sources',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...sortedIncomes.take(5).map((entry) => _buildCategoryRow(entry.key, entry.value, Colors.green)),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCategoryRow(String category, double amount, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              category,
              style: const TextStyle(fontSize: 14),
            ),
          ),
          Text(
            '\$${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Map<String, double> _getCategoryIncomes(List<Transaction1> transactions) {
    final incomes = transactions.where((t) => t.type == TransactionType.income);
    final categoryIncomes = <String, double>{};

    for (final income in incomes) {
      categoryIncomes[income.category] = (categoryIncomes[income.category] ?? 0) + income.amount;
    }

    return categoryIncomes;
  }

  Widget _buildTransactionStats() {
    return StreamBuilder<firestore.QuerySnapshot>(
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
              return Transaction1.fromMap(doc.id, doc.data() as Map<String, dynamic>);
            }).toList() ??
            [];

        final filteredTransactions = _filterTransactionsByPeriod(transactions);
        final totalIncome = _calculateTotalIncome(filteredTransactions);
        final totalExpense = _calculateTotalExpense(filteredTransactions);
        final balance = totalIncome - totalExpense;
        final categoryExpenses = _getCategoryExpenses(filteredTransactions);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Transaction Statistics',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildSummaryCards(totalIncome, totalExpense, balance),
            const SizedBox(height: 24),
            _buildExpenseChart(categoryExpenses),
            const SizedBox(height: 24),
            _buildIncomeExpenseTrend(filteredTransactions),
          ],
        );
      },
    );
  }

  Widget _buildBudgetStats() {
    return StreamBuilder<List<Budget>>(
      stream: firestore.FirebaseFirestore.instance
          .collection('budgets')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .where('isActive', isEqualTo: true)
          .snapshots()
          .map((snapshot) => snapshot.docs.map((doc) => Budget.fromMap(doc.id, doc.data())).toList()),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final budgets = snapshot.data!;
        final totalBudget = budgets.fold(0.0, (sum, budget) => sum + budget.amount);
        final totalSpent = budgets.fold(0.0, (sum, budget) => sum + budget.spent);
        final overBudgetCategories = budgets.where((b) => b.isOverBudget).length;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Budget Statistics',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildStatRow('Total Budget', totalBudget),
                    const SizedBox(height: 8),
                    _buildStatRow('Total Spent', totalSpent),
                    const SizedBox(height: 8),
                    _buildStatRow('Remaining', totalBudget - totalSpent),
                    const SizedBox(height: 8),
                    Text(
                      'Over Budget Categories: $overBudgetCategories',
                      style: TextStyle(
                        color: overBudgetCategories > 0 ? Colors.red : Colors.green,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildBudgetProgressList(budgets),
          ],
        );
      },
    );
  }

  Widget _buildLoanStats() {
    return StreamBuilder<List<Loan>>(
      stream: firestore.FirebaseFirestore.instance
          .collection('loans')
          .where('userId', isEqualTo: FirebaseAuth.instance.currentUser?.uid)
          .snapshots()
          .map((snapshot) => snapshot.docs.map((doc) => Loan.fromMap(doc.id, doc.data())).toList()),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();

        final loans = snapshot.data!;
        final totalBorrowed =
            loans.where((loan) => loan.type == LoanType.borrow).fold(0.0, (sum, loan) => sum + loan.remainingAmount);
        final totalLent = loans.where((loan) => loan.type == LoanType.lend).fold(0.0, (sum, loan) => sum + loan.remainingAmount);
        final activeLoans = loans.where((loan) => loan.status == LoanStatus.active).length;
        final overdueLoans = loans.where((loan) => loan.status == LoanStatus.overdue).length;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Loan Statistics',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildStatRow('Total Borrowed', totalBorrowed),
                    const SizedBox(height: 8),
                    _buildStatRow('Total Lent', totalLent),
                    const SizedBox(height: 8),
                    _buildStatRow('Net Loan Position', totalLent - totalBorrowed),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Active Loans: $activeLoans',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Overdue Loans: $overdueLoans',
                          style: TextStyle(
                            color: overdueLoans > 0 ? Colors.red : Colors.green,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStatRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label),
        Text(
          '\$${amount.toStringAsFixed(2)}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildBudgetProgressList(List<Budget> budgets) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: budgets.map((budget) {
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      budget.category,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      '\$${budget.spent.toStringAsFixed(2)} / \$${budget.amount.toStringAsFixed(2)}',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: budget.progress,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(
                    budget.isOverBudget ? Colors.red : Colors.green,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildIncomeExpenseTrend(List<Transaction1> transactions) {
    // Group transactions by date
    final Map<String, double> incomeByDate = {};
    final Map<String, double> expenseByDate = {};

    for (var transaction in transactions) {
      final date = DateFormat('MMM d').format(transaction.date);
      if (transaction.type == TransactionType.income) {
        incomeByDate[date] = (incomeByDate[date] ?? 0) + transaction.amount;
      } else {
        expenseByDate[date] = (expenseByDate[date] ?? 0) + transaction.amount;
      }
    }

    // Get all unique dates
    final dates = {...incomeByDate.keys, ...expenseByDate.keys}.toList()..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Income vs Expense Trend',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 200,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(show: false),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                rightTitles: AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                topTitles: AxisTitles(
                  sideTitles: SideTitles(showTitles: false),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      if (value.toInt() >= 0 && value.toInt() < dates.length) {
                        return Text(dates[value.toInt()]);
                      }
                      return const Text('');
                    },
                  ),
                ),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: dates.asMap().entries.map((entry) {
                    return FlSpot(
                      entry.key.toDouble(),
                      incomeByDate[entry.value] ?? 0,
                    );
                  }).toList(),
                  isCurved: true,
                  color: Colors.green,
                  barWidth: 3,
                  dotData: FlDotData(show: false),
                ),
                LineChartBarData(
                  spots: dates.asMap().entries.map((entry) {
                    return FlSpot(
                      entry.key.toDouble(),
                      expenseByDate[entry.value] ?? 0,
                    );
                  }).toList(),
                  isCurved: true,
                  color: Colors.red,
                  barWidth: 3,
                  dotData: FlDotData(show: false),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  List<Transaction1> _filterTransactionsByPeriod(List<Transaction1> transactions) {
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

  double _calculateTotalIncome(List<Transaction1> transactions) {
    return transactions.where((t) => t.type == TransactionType.income).fold(0, (sum, t) => sum + t.amount);
  }

  double _calculateTotalExpense(List<Transaction1> transactions) {
    return transactions.where((t) => t.type == TransactionType.expense).fold(0, (sum, t) => sum + t.amount);
  }

  Map<String, double> _getCategoryExpenses(List<Transaction1> transactions) {
    final expenses = transactions.where((t) => t.type == TransactionType.expense);
    final categoryExpenses = <String, double>{};

    for (final expense in expenses) {
      categoryExpenses[expense.category] = (categoryExpenses[expense.category] ?? 0) + expense.amount;
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
                  color: Colors.primaries[categoryExpenses.keys.toList().indexOf(entry.key) % Colors.primaries.length],
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
}
