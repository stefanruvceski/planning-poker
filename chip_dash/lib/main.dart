import 'package:flutter/material.dart';

import 'game_screen.dart';

void main() => runApp(const ChipDashApp());

class ChipDashApp extends StatelessWidget {
  const ChipDashApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Chip Dash',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        fontFamily: 'monospace',
      ),
      home: const GameScreen(),
    );
  }
}
