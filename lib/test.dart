// import 'package:flutter/material.dart';
// import 'package:flutter_gemini/flutter_gemini.dart';
//
// void main() {
//   WidgetsFlutterBinding.ensureInitialized();
//
//   // Initialize the Gemini SDK with your API key
//   const apiKey = 'AIzaSyDRMY69Gr3B0LDlxt8lrOXmQ9T3QJsb-28';
//   Gemini.init(
//     apiKey: apiKey,
//     enableDebugging: true, // optional: prints HTTP logs
//   );
//
//   runApp(const MyApp());
// }
//
// class MyApp extends StatelessWidget {
//   const MyApp({Key? key}) : super(key: key);
//
//   @override
//   Widget build(BuildContext context) {
//     return MaterialApp(
//       title: 'Gemini Plugin Demo',
//       theme: ThemeData(primarySwatch: Colors.blue),
//       home: const GeminiChatScreen(),
//     );
//   }
// }
//
// class GeminiChatScreen extends StatefulWidget {
//   const GeminiChatScreen({Key? key}) : super(key: key);
//
//   @override
//   _GeminiChatScreenState createState() => _GeminiChatScreenState();
// }
//
// class _GeminiChatScreenState extends State<GeminiChatScreen> {
//   final TextEditingController _promptController = TextEditingController();
//   String _response = '';
//   bool _isLoading = false;
//
//   Future<void> _sendPrompt() async {
//     final prompt = _promptController.text.trim();
//     if (prompt.isEmpty) return;
//
//     setState(() {
//       _isLoading = true;
//       _response = '';
//     });
//
//     try {
//       // Use the plugin's prompt() method and Part.text()
//       final candidates = await Gemini.instance.prompt(
//         parts: [Part.text(prompt)],           // factory for text-based parts :contentReference[oaicite:0]{index=0}
//       );
//
//       setState(() {
//         // .output is provided by CandidateExtension on Candidates
//         _response = candidates?.output ?? '– no output –';
//       });
//     } catch (e) {
//       setState(() {
//         _response = 'Error: $e';
//       });
//     } finally {
//       setState(() {
//         _isLoading = false;
//       });
//     }
//   }
//
//   @override
//   void dispose() {
//     _promptController.dispose();
//     super.dispose();
//   }
//
//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       appBar: AppBar(title: const Text('Gemini Plugin Demo')),
//       body: Padding(
//         padding: const EdgeInsets.all(16),
//         child: Column(
//           children: [
//             TextField(
//               controller: _promptController,
//               decoration: const InputDecoration(
//                 labelText: 'Enter prompt',
//                 border: OutlineInputBorder(),
//               ),
//               minLines: 1,
//               maxLines: 4,
//             ),
//             const SizedBox(height: 12),
//             ElevatedButton(
//               onPressed: _isLoading ? null : _sendPrompt,
//               child: _isLoading
//                   ? const SizedBox(
//                 width: 20,
//                 height: 20,
//                 child: CircularProgressIndicator(
//                   strokeWidth: 2,
//                   color: Colors.white,
//                 ),
//               )
//                   : const Text('Send'),
//             ),
//             const SizedBox(height: 24),
//             Expanded(
//               child: SingleChildScrollView(
//                 child: Text(
//                   _response,
//                   style: const TextStyle(fontSize: 16),
//                 ),
//               ),
//             ),
//           ],
//         ),
//       ),
//     );
//   }
// }
