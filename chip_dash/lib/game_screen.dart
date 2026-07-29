import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_painter.dart';
import 'pipe.dart';

enum GameState { ready, playing, gameOver }

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen>
    with SingleTickerProviderStateMixin {
  // --- Tuning constants (the "feel" of the game lives here) ---
  static const double _gravity = 1900; // px/s^2, pulls the chip down
  static const double _jumpVelocity = -560; // px/s, upward impulse on tap
  static const double _pipeSpeed = 190; // px/s, how fast the felt scrolls
  static const double _pipeWidth = 74;
  static const double _gapHeight = 210; // vertical opening the chip fits through
  static const double _pipeSpacing = 240; // horizontal px between pipes
  static const double _chipRadius = 20;
  static const double _groundHeight = 90;

  late final Ticker _ticker;
  final Random _rng = Random();

  Size _size = Size.zero;
  Duration _lastTick = Duration.zero;

  GameState _state = GameState.ready;

  // Chip (the player) — position in logical pixels, velocity in px/s.
  double _chipX = 0;
  double _chipY = 0;
  double _chipVy = 0;
  double _chipAngle = 0;

  final List<Pipe> _pipes = [];

  int _score = 0;
  int _highScore = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
    _loadHighScore();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  double get _groundY => _size.height - _groundHeight;

  Future<void> _loadHighScore() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() => _highScore = prefs.getInt('highScore') ?? 0);
  }

  Future<void> _saveHighScore() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('highScore', _highScore);
  }

  // --- State transitions -----------------------------------------------------

  void _resetToReady() {
    _chipX = _size.width * 0.3;
    _chipY = _size.height * 0.4;
    _chipVy = 0;
    _chipAngle = 0;
    _pipes.clear();
    _score = 0;
    _state = GameState.ready;
  }

  void _startGame() {
    _resetToReady();
    _state = GameState.playing;
    _flap();
  }

  void _flap() => _chipVy = _jumpVelocity;

  void _onTap() {
    switch (_state) {
      case GameState.ready:
        _startGame();
      case GameState.playing:
        _flap();
      case GameState.gameOver:
        setState(_resetToReady);
    }
  }

  void _gameOver() {
    _state = GameState.gameOver;
    if (_score > _highScore) {
      _highScore = _score;
      _saveHighScore();
    }
  }

  // --- Game loop -------------------------------------------------------------

  void _onTick(Duration elapsed) {
    if (_size == Size.zero) return;

    final double dt = _lastTick == Duration.zero
        ? 0
        : (elapsed - _lastTick).inMicroseconds / 1e6;
    _lastTick = elapsed;
    if (dt <= 0) return;

    // Clamp the step so a lag spike can't teleport the chip through a pipe.
    final double step = dt.clamp(0.0, 1 / 30);

    if (_state == GameState.playing) {
      _updatePhysics(step);
      setState(() {});
    } else if (_state == GameState.ready) {
      // Gentle bob while waiting for the first tap.
      _chipY = _size.height * 0.4 + sin(elapsed.inMilliseconds / 300) * 10;
      setState(() {});
    }
  }

  void _updatePhysics(double dt) {
    // Chip physics.
    _chipVy += _gravity * dt;
    _chipY += _chipVy * dt;
    _chipAngle = (_chipVy / 900).clamp(-0.5, 1.2);

    // Scroll and recycle pipes.
    for (final p in _pipes) {
      p.x -= _pipeSpeed * dt;
    }
    _pipes.removeWhere((p) => p.x + _pipeWidth < 0);

    // Spawn a new pipe once the last one has moved far enough left.
    if (_pipes.isEmpty || _size.width - _pipes.last.x >= _pipeSpacing) {
      _spawnPipe();
    }

    // Scoring: one point per pipe the chip fully clears.
    for (final p in _pipes) {
      if (!p.scored && p.x + _pipeWidth < _chipX) {
        p.scored = true;
        _score++;
      }
    }

    // Collisions: ground, ceiling, or a pipe.
    if (_chipY + _chipRadius >= _groundY || _chipY - _chipRadius <= 0) {
      _gameOver();
      return;
    }
    for (final p in _pipes) {
      if (_hitsPipe(p)) {
        _gameOver();
        return;
      }
    }
  }

  void _spawnPipe() {
    const double margin = 70;
    final double minC = margin + _gapHeight / 2;
    final double maxC = _groundY - margin - _gapHeight / 2;
    final double gapCenter = minC + _rng.nextDouble() * (maxC - minC);
    _pipes.add(Pipe(x: _size.width, gapCenter: gapCenter));
  }

  bool _hitsPipe(Pipe p) {
    // Outside the pipe's horizontal band → no collision possible.
    if (_chipX + _chipRadius < p.x || _chipX - _chipRadius > p.x + _pipeWidth) {
      return false;
    }
    final double gapTop = p.gapCenter - _gapHeight / 2;
    final double gapBottom = p.gapCenter + _gapHeight / 2;
    // Within the band, the chip is safe only while fully inside the gap.
    return _chipY - _chipRadius < gapTop || _chipY + _chipRadius > gapBottom;
  }

  // --- UI --------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, constraints.maxHeight);
          if (size != _size) {
            _size = size;
            if (_state == GameState.ready && _chipX == 0) {
              _resetToReady();
            }
          }
          return GestureDetector(
            onTap: _onTap,
            child: Stack(
              children: [
                CustomPaint(
                  size: size,
                  painter: GamePainter(
                    chipX: _chipX,
                    chipY: _chipY,
                    chipAngle: _chipAngle,
                    chipRadius: _chipRadius,
                    pipes: _pipes,
                    pipeWidth: _pipeWidth,
                    gapHeight: _gapHeight,
                    groundY: _groundY,
                  ),
                ),
                _buildOverlay(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildOverlay() {
    const white = TextStyle(color: Colors.white, fontWeight: FontWeight.bold);
    switch (_state) {
      case GameState.ready:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('CHIP DASH',
                  style: white.copyWith(fontSize: 46, letterSpacing: 3)),
              const SizedBox(height: 10),
              Text('Tap to flap through the felt',
                  style: white.copyWith(fontSize: 15, color: Colors.white70)),
              const SizedBox(height: 44),
              _tapHint('TAP TO START'),
              const SizedBox(height: 26),
              Text('Best: $_highScore',
                  style: white.copyWith(fontSize: 16, color: Colors.amber)),
            ],
          ),
        );
      case GameState.playing:
        return Positioned(
          top: 64,
          left: 0,
          right: 0,
          child: Center(
            child: Text('$_score',
                style: white.copyWith(
                  fontSize: 60,
                  shadows: const [Shadow(blurRadius: 8, color: Colors.black54)],
                )),
          ),
        );
      case GameState.gameOver:
        return Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.55),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('GAME OVER',
                    style: white.copyWith(fontSize: 32, letterSpacing: 2)),
                const SizedBox(height: 20),
                Text('Score   $_score', style: white.copyWith(fontSize: 22)),
                const SizedBox(height: 6),
                Text('Best    $_highScore',
                    style: white.copyWith(fontSize: 18, color: Colors.amber)),
                const SizedBox(height: 26),
                _tapHint('TAP TO RETRY'),
              ],
            ),
          ),
        );
    }
  }

  Widget _tapHint(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.amber,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF0B3D2E),
          fontWeight: FontWeight.bold,
          fontSize: 18,
          letterSpacing: 1,
        ),
      ),
    );
  }
}
