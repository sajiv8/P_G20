/**
 * Pure booking rules — no database, no network, no Fastify.
 *
 * These decide who loses a booking and how many tokens a student is charged,
 * so they are kept free of I/O to stay directly unit testable.
 */

export const ROLE_PRIORITY: Record<string, number> = {
  main_admin: 5,
  tenant_admin: 5,
  lecturer: 4,
  junior_lecturer: 3,
  staff: 2,
  student: 1,
};

const AUTO_APPROVED_ROLES = ['main_admin', 'tenant_admin', 'lecturer', 'junior_lecturer'];

const STUDENT_BOOKABLE_CATEGORIES = ['EQUIPMENT', 'ST_RESOURCE'];

const MS_PER_HOUR = 1000 * 60 * 60;

export interface OverlappingBooking {
  id: string;
  /** Role of the user who owns the overlapping booking. */
  role: string;
}

export type BookingDecision =
  | { action: 'conflict' }
  | { action: 'proceed'; bumpedIds: string[] };

/** Unknown roles rank below every known role. */
export function priorityOf(role: string): number {
  return ROLE_PRIORITY[role] ?? 0;
}

/**
 * Decides what happens when a booking request collides with existing ones.
 *
 * A single overlap of equal or higher priority blocks the whole request —
 * even if other overlaps would have been bumpable.
 */
export function decideBooking(
  requesterRole: string,
  overlapping: OverlappingBooking[],
): BookingDecision {
  const requesterPriority = priorityOf(requesterRole);
  const bumpedIds: string[] = [];

  for (const booking of overlapping) {
    if (priorityOf(booking.role) >= requesterPriority) {
      return { action: 'conflict' };
    }
    bumpedIds.push(booking.id);
  }

  return { action: 'proceed', bumpedIds };
}

/** Senior roles skip the approval queue. */
export function initialBookingStatus(role: string): 'approved' | 'pending' {
  return AUTO_APPROVED_ROLES.includes(role) ? 'approved' : 'pending';
}

/** Students are limited to equipment and student-shared items. */
export function isCategoryBookableByRole(role: string, category: string | null): boolean {
  if (role !== 'student') return true;
  return category !== null && STUDENT_BOOKABLE_CATEGORIES.includes(category);
}

/** Part-hours round up, and every booking is charged at least one hour. */
export function billableHours(startTime: string, endTime: string): number {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  return Math.max(1, Math.ceil((endMs - startMs) / MS_PER_HOUR));
}

/** Token cost of a booking, rounded up to a whole token. */
export function calculateBookingCost(
  hourlyCost: number,
  startTime: string,
  endTime: string,
): number {
  return Math.ceil(hourlyCost * billableHours(startTime, endTime));
}

/**
 * Refund for a cancelled booking: half the original charge, rounded down.
 * Accepts the stored transaction amount, which is negative for a deduction.
 */
export function calculateRefund(originalAmount: number): number {
  return Math.floor(Math.abs(originalAmount) / 2);
}

/**
 * Refund for a booking displaced by a higher-priority user.
 *
 * The whole charge comes back, unlike the half kept on a cancellation: the
 * student did not choose to give up the slot, so charging them for it would
 * penalise them for someone else's booking.
 */
export function calculateBumpRefund(originalAmount: number): number {
  return Math.abs(originalAmount);
}

/**
 * Checks a requested booking window. Returns a message explaining the problem,
 * or null when the window is usable.
 *
 * Without this, a reversed window is accepted and then behaves unpredictably:
 * the overlap query finds nothing (it looks for rows starting before the end
 * and ending after the start, which no row can satisfy) and the cost lands at
 * the one-hour minimum, so the booking is charged as if it were valid.
 *
 * Whether a booking may be in the past is a separate product question and is
 * deliberately not decided here.
 */
export function validateBookingWindow(startTime: unknown, endTime: unknown): string | null {
  if (typeof startTime !== 'string' || typeof endTime !== 'string') {
    return 'start_time and end_time must be ISO date strings';
  }

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (Number.isNaN(start)) return 'start_time is not a valid date';
  if (Number.isNaN(end)) return 'end_time is not a valid date';
  if (end <= start) return 'end_time must be after start_time';

  return null;
}
