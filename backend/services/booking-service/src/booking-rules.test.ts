import {
  priorityOf,
  decideBooking,
  initialBookingStatus,
  isCategoryBookableByRole,
  billableHours,
  calculateBookingCost,
  calculateRefund,
  calculateBumpRefund,
  validateBookingWindow,
} from './booking-rules';

describe('priorityOf', () => {
  it('ranks admins above lecturers above students', () => {
    expect(priorityOf('main_admin')).toBe(5);
    expect(priorityOf('tenant_admin')).toBe(5);
    expect(priorityOf('lecturer')).toBe(4);
    expect(priorityOf('junior_lecturer')).toBe(3);
    expect(priorityOf('staff')).toBe(2);
    expect(priorityOf('student')).toBe(1);
  });

  it('ranks an unrecognised role below every known role', () => {
    expect(priorityOf('visitor')).toBe(0);
    expect(priorityOf('')).toBe(0);
  });
});

describe('decideBooking', () => {
  const overlap = (id: string, role: string) => ({ id, role });

  // TC-BOOK-01 / TC-BOOK-02
  it('proceeds with nothing bumped when the slot is free', () => {
    expect(decideBooking('student', [])).toEqual({ action: 'proceed', bumpedIds: [] });
  });

  // TC-BOOK-04
  it('rejects a student booking over another student', () => {
    expect(decideBooking('student', [overlap('b1', 'student')])).toEqual({ action: 'conflict' });
  });

  // TC-BOOK-05
  it('lets a lecturer bump a student', () => {
    expect(decideBooking('lecturer', [overlap('b1', 'student')])).toEqual({
      action: 'proceed',
      bumpedIds: ['b1'],
    });
  });

  // TC-BOOK-06
  it('rejects a student booking over a lecturer', () => {
    expect(decideBooking('student', [overlap('b1', 'lecturer')])).toEqual({ action: 'conflict' });
  });

  it('lets an admin bump a lecturer', () => {
    expect(decideBooking('main_admin', [overlap('b1', 'lecturer')])).toEqual({
      action: 'proceed',
      bumpedIds: ['b1'],
    });
  });

  it('rejects a tenant_admin booking over a main_admin, since both rank 5', () => {
    expect(decideBooking('tenant_admin', [overlap('b1', 'main_admin')])).toEqual({
      action: 'conflict',
    });
  });

  it('bumps every lower-priority booking when there are several', () => {
    const decision = decideBooking('lecturer', [
      overlap('b1', 'student'),
      overlap('b2', 'staff'),
      overlap('b3', 'junior_lecturer'),
    ]);
    expect(decision).toEqual({ action: 'proceed', bumpedIds: ['b1', 'b2', 'b3'] });
  });

  it('bumps nobody if any single overlap outranks the requester', () => {
    const decision = decideBooking('junior_lecturer', [
      overlap('b1', 'student'),
      overlap('b2', 'lecturer'),
      overlap('b3', 'student'),
    ]);
    expect(decision).toEqual({ action: 'conflict' });
  });

  it('treats a booking with an unknown owner role as bumpable', () => {
    expect(decideBooking('student', [overlap('b1', 'visitor')])).toEqual({
      action: 'proceed',
      bumpedIds: ['b1'],
    });
  });

  it('rejects a requester with an unknown role against any real booking', () => {
    expect(decideBooking('visitor', [overlap('b1', 'student')])).toEqual({ action: 'conflict' });
  });

  it('does not mutate the list it was given', () => {
    const overlaps = [overlap('b1', 'student')];
    decideBooking('lecturer', overlaps);
    expect(overlaps).toEqual([{ id: 'b1', role: 'student' }]);
  });
});

describe('initialBookingStatus', () => {
  // TC-BOOK-02
  it.each(['main_admin', 'tenant_admin', 'lecturer', 'junior_lecturer'])(
    'auto-approves a booking made by %s',
    role => {
      expect(initialBookingStatus(role)).toBe('approved');
    },
  );

  // TC-BOOK-01
  it.each(['student', 'staff', 'visitor'])('queues a booking made by %s for approval', role => {
    expect(initialBookingStatus(role)).toBe('pending');
  });
});

describe('isCategoryBookableByRole', () => {
  // TC-BOOK-03
  it('lets a student book equipment and student-shared items', () => {
    expect(isCategoryBookableByRole('student', 'EQUIPMENT')).toBe(true);
    expect(isCategoryBookableByRole('student', 'ST_RESOURCE')).toBe(true);
  });

  it('stops a student booking anything else', () => {
    expect(isCategoryBookableByRole('student', 'LAB')).toBe(false);
    expect(isCategoryBookableByRole('student', 'LECTURE_HALL')).toBe(false);
    expect(isCategoryBookableByRole('student', null)).toBe(false);
  });

  it('places no category limit on non-students', () => {
    expect(isCategoryBookableByRole('lecturer', 'LAB')).toBe(true);
    expect(isCategoryBookableByRole('tenant_admin', null)).toBe(true);
  });
});

describe('billableHours', () => {
  const at = (hhmm: string) => `2026-03-01T${hhmm}:00.000Z`;

  it('counts a whole number of hours exactly', () => {
    expect(billableHours(at('10:00'), at('12:00'))).toBe(2);
  });

  // TC-TOK-03
  it('rounds a part-hour up', () => {
    expect(billableHours(at('10:00'), at('11:30'))).toBe(2);
    expect(billableHours(at('10:00'), at('11:01'))).toBe(2);
  });

  // TC-TOK-04
  it('charges a minimum of one hour', () => {
    expect(billableHours(at('10:00'), at('10:20'))).toBe(1);
    expect(billableHours(at('10:00'), at('10:00'))).toBe(1);
  });
});

describe('calculateBookingCost', () => {
  const at = (hhmm: string) => `2026-03-01T${hhmm}:00.000Z`;

  // TC-TOK-02
  it('charges the hourly rate for each hour', () => {
    expect(calculateBookingCost(10, at('10:00'), at('12:00'))).toBe(20);
    expect(calculateBookingCost(7, at('10:00'), at('13:00'))).toBe(21);
  });

  // TC-TOK-03
  it('charges a rounded-up part-hour at the full rate', () => {
    expect(calculateBookingCost(10, at('10:00'), at('11:30'))).toBe(20);
  });

  // TC-TOK-04
  it('charges one hour for a very short booking', () => {
    expect(calculateBookingCost(10, at('10:00'), at('10:20'))).toBe(10);
  });

  it('rounds a fractional rate up to a whole token', () => {
    expect(calculateBookingCost(2.5, at('10:00'), at('11:00'))).toBe(3);
    expect(calculateBookingCost(2.5, at('10:00'), at('12:00'))).toBe(5);
  });

  it('costs nothing when the resource is free', () => {
    expect(calculateBookingCost(0, at('10:00'), at('14:00'))).toBe(0);
  });
});

describe('calculateRefund', () => {
  // TC-TOK-06
  it('refunds half of an even charge', () => {
    expect(calculateRefund(20)).toBe(10);
  });

  it('rounds an odd charge down, in the platform’s favour', () => {
    expect(calculateRefund(21)).toBe(10);
    expect(calculateRefund(1)).toBe(0);
  });

  it('accepts the stored negative deduction amount', () => {
    expect(calculateRefund(-20)).toBe(10);
    expect(calculateRefund(-21)).toBe(10);
  });

  it('refunds nothing for a free booking', () => {
    expect(calculateRefund(0)).toBe(0);
  });
});

describe('calculateBumpRefund', () => {
  // TC-TOK-07 — a displaced student did not choose to lose the slot.
  it('returns the whole charge, not half', () => {
    expect(calculateBumpRefund(-20)).toBe(20);
    expect(calculateBumpRefund(-21)).toBe(21);
  });

  it('is never less than a cancellation refund for the same charge', () => {
    for (const amount of [1, 2, 7, 20, 21, 100]) {
      expect(calculateBumpRefund(-amount)).toBeGreaterThanOrEqual(calculateRefund(-amount));
    }
  });

  it('refunds nothing for a free booking', () => {
    expect(calculateBumpRefund(0)).toBe(0);
  });
});

describe('validateBookingWindow', () => {
  const at = (hhmm: string) => `2027-03-01T${hhmm}:00.000Z`;

  it('accepts a normal forward window', () => {
    expect(validateBookingWindow(at('10:00'), at('12:00'))).toBeNull();
  });

  // TC-BOOK-12 / D-04 — a reversed window used to be accepted silently.
  it('rejects an end before the start', () => {
    expect(validateBookingWindow(at('12:00'), at('10:00'))).toMatch(/after start_time/);
  });

  it('rejects a zero-length window', () => {
    expect(validateBookingWindow(at('10:00'), at('10:00'))).toMatch(/after start_time/);
  });

  it('rejects an unparseable date', () => {
    expect(validateBookingWindow('not-a-date', at('12:00'))).toMatch(/start_time is not a valid date/);
    expect(validateBookingWindow(at('10:00'), 'tomorrow-ish')).toMatch(/end_time is not a valid date/);
  });

  it('rejects non-string input', () => {
    expect(validateBookingWindow(undefined, at('12:00'))).toMatch(/ISO date strings/);
    expect(validateBookingWindow(at('10:00'), 12345)).toMatch(/ISO date strings/);
  });

  it('accepts a one-minute window', () => {
    expect(validateBookingWindow(at('10:00'), at('10:01'))).toBeNull();
  });
});
