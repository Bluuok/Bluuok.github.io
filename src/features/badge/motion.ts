const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const suspension = { anchorY: 3.95, length: 2.5, maxAngle: 0.42 } as const;

/** A damped pendulum and a softer swivel keep the badge rigid and its tether taut. */
export class BadgeMotion {
  maxAngle: number = suspension.maxAngle;
  angle = -0.045;
  velocity = 0;
  tilt = -0.079;
  tiltVelocity = 0;
  yaw = -0.23;
  yawVelocity = 0;
  time = 0;
  dragging = false;
  private targetAngle = 0;
  private targetYaw = -0.23;

  get x() { return Math.sin(this.angle) * suspension.length; }
  get y() { return suspension.anchorY - Math.cos(this.angle) * suspension.length; }

  grab(x: number, y: number) {
    this.dragging = true;
    this.move(x, y);
  }

  move(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.targetAngle = clamp(Math.atan2(x, Math.max(0.7, suspension.anchorY - y)), -this.maxAngle, this.maxAngle);
    this.targetYaw = clamp(-0.23 + x * 0.2, -0.52, 0.4);
  }

  release() { this.dragging = false; }

  nudge(direction = 1, strength = 1) {
    if (this.dragging) return;
    const impulse = clamp(direction, -1, 1) * clamp(strength, 0, 1);
    this.velocity = clamp(this.velocity + impulse * 0.72, -1.8, 1.8);
    this.yawVelocity = clamp(this.yawVelocity - impulse * 0.65, -1.4, 1.4);
  }

  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    // Bounded substeps also make resuming a background tab safe.
    let remaining = Math.min(seconds, 0.08);
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      remaining -= dt;
      this.time += dt;
      const acceleration = this.dragging
        ? (this.targetAngle - this.angle) * 100 - this.velocity * 17
        : -12 * Math.sin(this.angle) - this.velocity * 1.55 + Math.sin(this.time * 0.85) * 0.018;
      this.velocity += acceleration * dt;
      this.angle += this.velocity * dt;
      if (Math.abs(this.angle) > this.maxAngle) {
        this.angle = clamp(this.angle, -this.maxAngle, this.maxAngle);
        this.velocity *= -0.12;
      }
      this.tiltVelocity += ((this.angle * 0.76 - 0.045 - this.tilt) * 28 - this.tiltVelocity * 6) * dt;
      this.tilt += this.tiltVelocity * dt;
      const swivel = this.dragging ? this.targetYaw : -0.23 + Math.sin(this.time * 0.65) * 0.035;
      this.yawVelocity += ((swivel - this.yaw) * 13 - this.yawVelocity * 3.9) * dt;
      this.yaw = clamp(this.yaw + this.yawVelocity * dt, -0.65, 0.65);
    }
  }

  reset() {
    this.angle = -0.045;
    this.tilt = -0.079;
    this.yaw = -0.23;
    this.velocity = this.tiltVelocity = this.yawVelocity = this.time = 0;
    this.dragging = false;
  }
}
