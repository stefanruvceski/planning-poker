/// A single obstacle: a top and bottom pillar with a gap the chip flies through.
class Pipe {
  Pipe({required this.x, required this.gapCenter});

  /// Left edge of the pipe, in logical pixels. Decreases as it scrolls left.
  double x;

  /// Vertical centre of the gap, in logical pixels.
  final double gapCenter;

  /// Whether the chip has already cleared this pipe, so we score it only once.
  bool scored = false;
}
