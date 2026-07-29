import 'dart:math';

import 'package:flutter/material.dart';

import 'pipe.dart';

/// Draws the whole scene each frame: felt background, pipes, ground and chip.
/// Everything is vector-drawn — the game ships with zero image assets.
class GamePainter extends CustomPainter {
  GamePainter({
    required this.chipX,
    required this.chipY,
    required this.chipAngle,
    required this.chipRadius,
    required this.pipes,
    required this.pipeWidth,
    required this.gapHeight,
    required this.groundY,
  });

  final double chipX;
  final double chipY;
  final double chipAngle;
  final double chipRadius;
  final List<Pipe> pipes;
  final double pipeWidth;
  final double gapHeight;
  final double groundY;

  @override
  void paint(Canvas canvas, Size size) {
    _paintBackground(canvas, size);
    _paintPipes(canvas);
    _paintGround(canvas, size);
    _paintChip(canvas);
  }

  void _paintBackground(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final bg = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFF0B3D2E), Color(0xFF124D3A), Color(0xFF0B3D2E)],
      ).createShader(rect);
    canvas.drawRect(rect, bg);

    // Faint felt emblem, a nod to the poker table.
    final emblem = Paint()..color = Colors.white.withOpacity(0.03);
    canvas.drawCircle(
      Offset(size.width / 2, size.height * 0.42),
      size.width * 0.35,
      emblem,
    );
  }

  void _paintPipes(Canvas canvas) {
    final fill = Paint()..color = const Color(0xFFC0392B);
    final gloss = Paint()..color = Colors.white.withOpacity(0.15);
    final cap = Paint()..color = const Color(0xFFA93226);
    const double capH = 26;

    for (final p in pipes) {
      final double gapTop = p.gapCenter - gapHeight / 2;
      final double gapBottom = p.gapCenter + gapHeight / 2;

      final Rect top = Rect.fromLTRB(p.x, -4, p.x + pipeWidth, gapTop);
      final Rect bottom = Rect.fromLTRB(p.x, gapBottom, p.x + pipeWidth, groundY);

      canvas.drawRect(top, fill);
      canvas.drawRect(bottom, fill);

      // Glossy vertical highlight for a bit of depth.
      canvas.drawRect(Rect.fromLTWH(p.x + 8, top.top, 10, top.height), gloss);
      canvas.drawRect(
          Rect.fromLTWH(p.x + 8, bottom.top, 10, bottom.height), gloss);

      // Rounded caps framing the gap.
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(p.x - 6, gapTop - capH, pipeWidth + 12, capH),
          const Radius.circular(6),
        ),
        cap,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(p.x - 6, gapBottom, pipeWidth + 12, capH),
          const Radius.circular(6),
        ),
        cap,
      );
    }
  }

  void _paintGround(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTRB(0, groundY, size.width, size.height),
      Paint()..color = const Color(0xFF6B4A2B),
    );
    canvas.drawRect(
      Rect.fromLTWH(0, groundY, size.width, 6),
      Paint()..color = const Color(0xFF87643C),
    );
  }

  void _paintChip(Canvas canvas) {
    canvas.save();
    canvas.translate(chipX, chipY);
    canvas.rotate(chipAngle);

    final double r = chipRadius;

    // Drop shadow.
    canvas.drawCircle(
        const Offset(0, 3), r, Paint()..color = Colors.black.withOpacity(0.25));

    // Chip body.
    canvas.drawCircle(Offset.zero, r, Paint()..color = const Color(0xFFF1C40F));

    // White edge notches around the rim.
    final notch = Paint()..color = Colors.white;
    for (int i = 0; i < 8; i++) {
      canvas.save();
      canvas.rotate(i * pi / 4);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(
              center: Offset(0, -r * 0.92), width: r * 0.34, height: r * 0.5),
          const Radius.circular(2),
        ),
        notch,
      );
      canvas.restore();
    }

    // Inner ring + face.
    canvas.drawCircle(
      Offset.zero,
      r * 0.62,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Colors.white,
    );
    canvas.drawCircle(
        Offset.zero, r * 0.5, Paint()..color = const Color(0xFFF39C12));

    // A single eye gives the chip a bit of character.
    canvas.drawCircle(
        Offset(r * 0.22, -r * 0.1), r * 0.14, Paint()..color = Colors.black);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant GamePainter old) => true; // animates every frame
}
