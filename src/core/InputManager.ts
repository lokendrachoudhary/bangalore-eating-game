export class InputManager {
  private keys = new Set<string>();
  private moveVector = { x: 0, z: 0 };
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private joystickSensitivity = 0.01;

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    // Touch controls - floating joystick
    window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('pointercancel', () => this.onPointerUp());
  }

  private onPointerDown(e: PointerEvent): void {
    // Only use left half of screen for joystick, or any touch on mobile
    if (e.clientX < window.innerWidth * 0.6 || e.pointerType === 'touch') {
      this.touchActive = true;
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.touchActive) return;
    const dx = (e.clientX - this.touchStartX) * this.joystickSensitivity;
    const dy = (e.clientY - this.touchStartY) * this.joystickSensitivity;
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    const maxMag = 1;
    if (magnitude > maxMag) {
      this.moveVector.x = (dx / magnitude) * maxMag;
      this.moveVector.z = (dy / magnitude) * maxMag;
    } else if (magnitude > 0.1) { // Dead zone
      this.moveVector.x = dx;
      this.moveVector.z = dy;
    } else {
      this.moveVector.x = 0;
      this.moveVector.z = 0;
    }
  }

  private onPointerUp(): void {
    this.touchActive = false;
    this.moveVector.x = 0;
    this.moveVector.z = 0;
  }

  getMovement(): { x: number; z: number } {
    // Keyboard input
    let kx = 0, kz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) kz = -1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) kz = 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx = -1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx = 1;

    // Normalize keyboard diagonal
    if (kx !== 0 && kz !== 0) {
      const inv = 1 / Math.SQRT2;
      kx *= inv;
      kz *= inv;
    }

    // Combine keyboard and touch (touch overrides if active)
    if (this.touchActive) {
      return { x: this.moveVector.x, z: this.moveVector.z };
    }
    return { x: kx, z: kz };
  }
}
