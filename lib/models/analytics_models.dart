import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

class Insight {
  final String message;
  final IconData icon;
  final Color color;

  Insight(this.message, this.icon, this.color);
}

class SpendingPattern {
  final String category;
  final List<FlSpot> dataPoints;
  final Color color;

  SpendingPattern(this.category, this.dataPoints, this.color);
}

class Suggestion {
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final double savings;

  Suggestion(this.title, this.description, this.icon, this.color, {this.savings = 0.0});
}

class Forecast {
  final List<FlSpot> dataPoints;
  final Color color;

  Forecast({
    required this.dataPoints,
    required this.color,
  });
} 