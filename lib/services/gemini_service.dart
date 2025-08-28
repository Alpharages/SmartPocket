import '../models/transaction.dart';
import '../models/analytics_models.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_gemini/flutter_gemini.dart';

class GeminiService {
  final Gemini _gemini = Gemini.instance;

  Future<List<Insight>> generateInsights(List<Transaction1> transactions) async {
    try {
      if (transactions.isEmpty) {
        return [
          Insight(
            'No transactions found for the selected period',
            Icons.info,
            Colors.blue,
          ),
        ];
      }

      final prompt = '''
      Analyze these financial transactions and provide 3 key insights in JSON format:
      ${transactions.map((t) => '${t.date}: ${t.amount} - ${t.category}').join('\n')}
      
      Return in this format:
      {
        "insights": [
          {
            "message": "insight message",
            "icon": "icon_name",
            "color": "color_name"
          }
        ]
      }
      ''';

      final response = await _gemini.text(prompt);
      if (response == null) {
        throw Exception('No response from Gemini');
      }

      return _parseInsightsResponse(response.output??"");
    } catch (e) {
      print('Error generating insights: $e');
      return [
        Insight(
          'Unable to generate insights at this time',
          Icons.error,
          Colors.red,
        ),
      ];
    }
  }

  Future<List<SpendingPattern>> analyzeSpendingPatterns(List<Transaction1> transactions) async {
    try {
      if (transactions.isEmpty) {
        return [];
      }

      final prompt = '''
      Analyze these transactions and identify spending patterns by category:
      ${transactions.map((t) => '${t.date}: ${t.amount} - ${t.category}').join('\n')}
      
      Return in this format:
      {
        "patterns": [
          {
            "category": "category_name",
            "dataPoints": [[x, y], ...],
            "color": "color_name"
          }
        ]
      }
      ''';

      final response = await _gemini.text(prompt);
      if (response == null) {
        throw Exception('No response from Gemini');
      }

      return _parseSpendingPatternsResponse(response.output??"");
    } catch (e) {
      print('Error analyzing spending patterns: $e');
      return [];
    }
  }

  Future<List<Suggestion>> generateSuggestions(List<Transaction1> transactions) async {
    try {
      if (transactions.isEmpty) {
        return [];
      }

      final prompt = '''
      Based on these transactions, provide personalized financial suggestions:
      ${transactions.map((t) => '${t.date}: ${t.amount} - ${t.category}').join('\n')}
      
      Return in this format:
      {
        "suggestions": [
          {
            "title": "suggestion title",
            "description": "suggestion description",
            "icon": "icon_name",
            "color": "color_name",
            "savings": savings_amount
          }
        ]
      }
      ''';

      final response = await _gemini.text(prompt);
      if (response == null) {
        throw Exception('No response from Gemini');
      }

      return _parseSuggestionsResponse(response.output??"");
    } catch (e) {
      print('Error generating suggestions: $e');
      return [];
    }
  }

  Future<Forecast> generateForecast(List<Transaction1> transactions, String scenario) async {
    try {
      if (transactions.isEmpty) {
        return Forecast(
          dataPoints: [],
          color: Colors.blue,
        );
      }

      final prompt = '''
      Based on these transactions, forecast future cash flow for the $scenario scenario:
      ${transactions.map((t) => '${t.date}: ${t.amount} - ${t.category}').join('\n')}
      
      Return in this format:
      {
        "forecast": {
          "dataPoints": [[x, y], ...],
          "color": "color_name"
        }
      }
      ''';

      final response = await _gemini.text(prompt);
      if (response == null) {
        throw Exception('No response from Gemini');
      }

      return _parseForecastResponse(response.output??"");
    } catch (e) {
      print('Error generating forecast: $e');
      return Forecast(
        dataPoints: [],
        color: Colors.blue,
      );
    }
  }

  // Helper methods to parse responses
  List<Insight> _parseInsightsResponse(String response) {
    try {
      final Map<String, dynamic> json = jsonDecode(response);
      final List<dynamic> insightsJson = json['insights'];

      return insightsJson.map((insight) {
        return Insight(
          insight['message'] as String,
          _getIconFromString(insight['icon'] as String),
          _parseColor(insight['color'] as String),
        );
      }).toList();
    } catch (e) {
      print('Error parsing insights response: $e');
      return [];
    }
  }

  List<SpendingPattern> _parseSpendingPatternsResponse(String response) {
    try {
      final Map<String, dynamic> json = jsonDecode(response);
      final List<dynamic> patternsJson = json['patterns'];

      return patternsJson.map((pattern) {
        final List<dynamic> points = pattern['dataPoints'];
        return SpendingPattern(
          pattern['category'] as String,
          points.map((point) => FlSpot(point[0].toDouble(), point[1].toDouble())).toList(),
          _parseColor(pattern['color'] as String),
        );
      }).toList();
    } catch (e) {
      print('Error parsing spending patterns response: $e');
      return [];
    }
  }

  List<Suggestion> _parseSuggestionsResponse(String response) {
    try {
      final Map<String, dynamic> json = jsonDecode(response);
      final List<dynamic> suggestionsJson = json['suggestions'];

      return suggestionsJson.map((suggestion) {
        return Suggestion(
          suggestion['title'] as String,
          suggestion['description'] as String,
          _getIconFromString(suggestion['icon'] as String),
          _parseColor(suggestion['color'] as String),
          savings: (suggestion['savings'] as num).toDouble(),
        );
      }).toList();
    } catch (e) {
      print('Error parsing suggestions response: $e');
      return [];
    }
  }

  Forecast _parseForecastResponse(String response) {
    try {
      final Map<String, dynamic> json = jsonDecode(response);
      final forecastData = json['forecast'];

      final List<dynamic> points = forecastData['dataPoints'];
      return Forecast(
        dataPoints: points.map((point) => FlSpot(point[0].toDouble(), point[1].toDouble())).toList(),
        color: _parseColor(forecastData['color'] as String),
      );
    } catch (e) {
      print('Error parsing forecast response: $e');
      return Forecast(
        dataPoints: [],
        color: Colors.blue,
      );
    }
  }

  IconData _getIconFromString(String iconName) {
    switch (iconName.toLowerCase()) {
      case 'restaurant':
        return Icons.restaurant;
      case 'savings':
        return Icons.savings;
      case 'notifications':
        return Icons.notifications;
      case 'stream':
        return Icons.stream;
      case 'shopping_cart':
        return Icons.shopping_cart;
      default:
        return Icons.info;
    }
  }

  Color _parseColor(String colorName) {
    switch (colorName.toLowerCase()) {
      case 'red':
        return Colors.red;
      case 'green':
        return Colors.green;
      case 'blue':
        return Colors.blue;
      case 'orange':
        return Colors.orange;
      default:
        return Colors.blue;
    }
  }
}
