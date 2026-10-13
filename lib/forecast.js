export const OWNER_ID = '7d7c0b4e-9f42-4a93-b8b4-7f5a7d6c1e21';

export function dateKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

export function monthDateRange(key) {
  const [year, month] = key.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end, days: end.getDate() };
}

export function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const toMinutes = (value) => {
    const [h, m] = String(value).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, (toMinutes(end) - toMinutes(start)) / 60);
}

export function amountForSession(session, students, useCurrentRate = false) {
  const student = students.find((s) => s.id === session.studentId);
  const rate = useCurrentRate ? Number(student?.rate || 0) : Number(session.rate || student?.rate || 0);
  return Math.max(0, Number(session.hours) || 0) * Math.max(0, rate);
}

export function buildMonthlyForecast({ month, students = [], schedule = [], sessions = [], exceptions = [], today = dateKey(new Date()) }) {
  const { start, days } = monthDateRange(month);
  const activeStudents = students.filter((s) => (s.status || 'active') === 'active');
  const rows = [];
  const seen = new Set();
  const exceptionsBySlotDate = new Set(exceptions.filter((e) => e.status === 'cancelled').map((e) => e.slotId + '|' + e.date));

  for (let dayNum = 1; dayNum <= days; dayNum += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), dayNum);
    const key = dateKey(date);
    const mondayIndex = (date.getDay() + 6) % 7;
    for (const slot of schedule) {
      const matches = (slot.recurring && Number(slot.day) === mondayIndex) || (!slot.recurring && slot.date === key);
      if (!matches || !activeStudents.some((s) => s.id === slot.studentId)) continue;
      const student = activeStudents.find((s) => s.id === slot.studentId);
      const uniqueKey = slot.id + '|' + key;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      const exception = exceptionsBySlotDate.has(uniqueKey);
      const session = sessions.find((s) => s.sourceSlotId === slot.id && s.date === key);
      const hours = hoursBetween(slot.start, slot.end);
      const amount = hours * Math.max(0, Number(student?.rate) || 0);
      let status = 'forecast';
      if (exception) status = 'cancelled';
      else if (session) status = 'confirmed';
      else if (key < today) status = 'pending';
      rows.push({
        id: uniqueKey,
        slotId: slot.id,
        date: key,
        start: slot.start || '',
        end: slot.end || '',
        hours: session ? Number(session.hours) || hours : hours,
        rate: Math.max(0, Number(student?.rate) || 0),
        amount,
        studentId: slot.studentId,
        studentName: student?.name || '',
        student,
        sessionId: session?.id || null,
        session,
        status,
      });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.studentName.localeCompare(b.studentName));
  const confirmed = rows.filter((r) => r.status === 'confirmed');
  const forecast = rows.filter((r) => r.status === 'forecast');
  const pending = rows.filter((r) => r.status === 'pending');
  const cancelled = rows.filter((r) => r.status === 'cancelled');
  return {
    month,
    rows,
    confirmed,
    forecast,
    pending,
    cancelled,
    confirmedAmount: confirmed.reduce((sum, r) => sum + amountForSession(r.session, students, false), 0),
    forecastAmount: forecast.reduce((sum, r) => sum + r.amount, 0),
    pendingAmount: pending.reduce((sum, r) => sum + r.amount, 0),
    projectedTotal: confirmed.reduce((sum, r) => sum + amountForSession(r.session, students, false), 0) + forecast.reduce((sum, r) => sum + r.amount, 0),
  };
}

export function buildNineMonthChart({ month, students = [], schedule = [], sessions = [], exceptions = [], today = dateKey(new Date()) }) {
  const [year, monthNumber] = month.split('-').map(Number);
  return Array.from({ length: 9 }, (_, index) => {
    const date = new Date(year, monthNumber - 1 + index - 6, 1);
    const key = monthKey(date);
    const model = buildMonthlyForecast({ month: key, students, schedule, sessions, exceptions, today });
    const actualSessions = sessions.filter((s) => s.date?.slice(0, 7) === key);
    const actualIds = new Set(actualSessions.filter((s) => s.sourceSlotId).map((s) => s.sourceSlotId + '|' + s.date));
    const confirmedAmount = actualSessions.reduce((sum, s) => sum + amountForSession(s, students, false), 0);
    const projectedAmount = model.forecast.filter((r) => !actualIds.has(r.slotId + '|' + r.date)).reduce((sum, r) => sum + r.amount, 0);
    return {
      month: key,
      label: date.toLocaleDateString('th-TH', { month: 'short' }),
      confirmed: confirmedAmount,
      forecast: date < new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1) ? 0 : projectedAmount,
    };
  });
}
