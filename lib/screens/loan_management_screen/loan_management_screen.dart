import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:smart_pocket/models/loan.dart';
import 'package:smart_pocket/models/repayment.dart';
import 'package:smart_pocket/services/loan_service.dart';
import 'package:intl/intl.dart';

class LoanManagementScreen extends StatefulWidget {
  const LoanManagementScreen({Key? key}) : super(key: key);

  @override
  State<LoanManagementScreen> createState() => _LoanManagementScreenState();
}

class _LoanManagementScreenState extends State<LoanManagementScreen> {
  final _loanService = LoanService();
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _personNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _repaymentAmountController = TextEditingController();

  LoanType _selectedType = LoanType.borrow;
  RepaymentFrequency _selectedFrequency = RepaymentFrequency.monthly;
  bool _isLoading = false;

  @override
  void dispose() {
    _amountController.dispose();
    _personNameController.dispose();
    _descriptionController.dispose();
    _repaymentAmountController.dispose();
    super.dispose();
  }

  Future<void> _createLoan() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final amount = double.parse(_amountController.text);
      final repaymentAmount = double.parse(_repaymentAmountController.text);

      final repayments = _loanService.generateRepaymentSchedule(
        totalAmount: amount,
        repaymentAmount: repaymentAmount,
        frequency: _selectedFrequency,
        startDate: DateTime.now(),
      );

      final loan = Loan(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        userId: FirebaseAuth.instance.currentUser!.uid,
        personName: _personNameController.text,
        amount: amount,
        remainingAmount: amount,
        type: _selectedType,
        status: LoanStatus.active,
        startDate: DateTime.now(),
        frequency: _selectedFrequency,
        repaymentAmount: repaymentAmount,
        description: _descriptionController.text,
        repayments: repayments,
      );

      await _loanService.createLoan(loan);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Loan created successfully'),
            backgroundColor: Colors.green,
          ),
        );
        _resetForm();
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error creating loan: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _resetForm() {
    _amountController.clear();
    _personNameController.clear();
    _descriptionController.clear();
    _repaymentAmountController.clear();
    setState(() {
      _selectedType = LoanType.borrow;
      _selectedFrequency = RepaymentFrequency.monthly;
    });
  }

  void _showAddLoanSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Add Loan',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () => Navigator.pop(context),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: RadioListTile<LoanType>(
                                      title: const Text('Borrow'),
                                      value: LoanType.borrow,
                                      groupValue: _selectedType,
                                      onChanged: (value) {
                                        setState(() => _selectedType = value!);
                                        setModalState(() {});
                                      },
                                    ),
                                  ),
                                  Expanded(
                                    child: RadioListTile<LoanType>(
                                      title: const Text('Lend'),
                                      value: LoanType.lend,
                                      groupValue: _selectedType,
                                      onChanged: (value) {
                                        setState(() => _selectedType = value!);
                                        setModalState(() {});
                                      },
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _personNameController,
                            decoration: InputDecoration(
                              labelText: 'Person Name',
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.grey[50],
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter a name';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _amountController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Amount',
                              prefixText: '\$',
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.grey[50],
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter an amount';
                              }
                              if (double.tryParse(value) == null) {
                                return 'Please enter a valid number';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _repaymentAmountController,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Repayment Amount',
                              prefixText: '\$',
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.grey[50],
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter a repayment amount';
                              }
                              if (double.tryParse(value) == null) {
                                return 'Please enter a valid number';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<RepaymentFrequency>(
                            value: _selectedFrequency,
                            decoration: InputDecoration(
                              labelText: 'Repayment Frequency',
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.grey[50],
                            ),
                            items: RepaymentFrequency.values
                                .map((frequency) => DropdownMenuItem(
                                      value: frequency,
                                      child: Text(frequency.toString().split('.').last),
                                    ))
                                .toList(),
                            onChanged: (value) {
                              setState(() => _selectedFrequency = value!);
                              setModalState(() {});
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _descriptionController,
                            decoration: InputDecoration(
                              labelText: 'Description',
                              border: const OutlineInputBorder(),
                              filled: true,
                              fillColor: Colors.grey[50],
                            ),
                            maxLines: 3,
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton(
                            onPressed: _isLoading
                                ? null
                                : () async {
                                    setModalState(() => _isLoading = true);
                                    await _createLoan();
                                    setModalState(() => _isLoading = false);
                                  },
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Create Loan'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _testNotification() async {
    try {
      await _loanService.testNotification();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Test notification scheduled'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error testing notification: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Loan Management',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: _testNotification,
          ),
        ],
      ),
      body: StreamBuilder<List<Loan>>(
        stream: _loanService.getLoans(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final loans = snapshot.data ?? [];

          if (loans.isEmpty) {
            return const Center(
              child: Text('No loans yet'),
            );
          }

          return ListView.builder(
            itemCount: loans.length,
            itemBuilder: (context, index) {
              final loan = loans[index];
              return Card(
                margin: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: ExpansionTile(
                  title: Text(loan.personName),
                  subtitle: Text(
                    '${loan.type == LoanType.borrow ? 'Borrowed' : 'Lent'}: \$${loan.amount.toStringAsFixed(2)}',
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Status: ${loan.status.toString().split('.').last}',
                            style: TextStyle(
                              color: loan.status == LoanStatus.active
                                  ? Colors.green
                                  : loan.status == LoanStatus.overdue
                                      ? Colors.red
                                      : Colors.grey,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Remaining: \$${loan.remainingAmount.toStringAsFixed(2)}',
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Start Date: ${DateFormat('MMM d, y').format(loan.startDate)}',
                          ),
                          if (loan.endDate != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              'End Date: ${DateFormat('MMM d, y').format(loan.endDate!)}',
                            ),
                          ],
                          const SizedBox(height: 16),
                          const Text(
                            'Repayment Schedule:',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...loan.repayments.map((repayment) {
                            return ListTile(
                              title: Text(
                                'Due: ${DateFormat('MMM d, y').format(repayment.dueDate)}',
                              ),
                              subtitle: Text(
                                'Amount: \$${repayment.amount.toStringAsFixed(2)}',
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Checkbox(
                                    value: repayment.status == RepaymentStatus.completed,
                                    onChanged: (bool? value) async {
                                      if (value == true) {
                                        try {
                                          await _loanService.updateRepaymentStatus(
                                            loan.id,
                                            repayment.id,
                                            RepaymentStatus.completed,
                                          );
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(
                                                content: Text('Payment marked as completed'),
                                                backgroundColor: Colors.green,
                                              ),
                                            );
                                          }
                                        } catch (e) {
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(
                                                content: Text('Error updating payment status: $e'),
                                                backgroundColor: Colors.red,
                                              ),
                                            );
                                          }
                                        }
                                      }
                                    },
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    repayment.status.toString().split('.').last,
                                    style: TextStyle(
                                      color: repayment.status == RepaymentStatus.completed
                                          ? Colors.green
                                          : repayment.status == RepaymentStatus.overdue
                                              ? Colors.red
                                              : Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddLoanSheet,
        child: const Icon(Icons.add),
      ),
    );
  }
}
