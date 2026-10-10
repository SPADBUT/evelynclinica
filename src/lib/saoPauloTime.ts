const TIME_ZONE = 'America/Sao_Paulo'

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function wallClock(instant: Date): WallClock {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const value = Object.fromEntries(formatted.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  let hour = Number(value.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour,
    minute: Number(value.minute),
    second: Number(value.second),
  }
}

function offsetMinutes(instant: Date): number {
  const wall = wallClock(instant)
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  return Math.round((wallAsUtc - instant.getTime()) / 60000)
}

export function nextCalendarDay(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1))
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utc.getUTCDate()).padStart(2, '0')
  return `${utc.getUTCFullYear()}-${month}-${day}`
}

function candidateOffsets(wallUtcMs: number): number[] {
  const offsets = new Set<number>()
  for (const shiftHours of [-36, -14, -3, -2, 0, 2, 3, 14, 36]) {
    offsets.add(offsetMinutes(new Date(wallUtcMs + shiftHours * 60 * 60 * 1000)))
  }
  return [...offsets]
}

/**
 * Interprets a calendar date and clock time as America/Sao_Paulo.
 * Returns an instant only when exactly one offset reproduces that wall time.
 * A daylight-saving gap and a repeated hour both return null, so an ambiguous
 * historical time is never stored as one of the two possible instants.
 */
export function saoPauloWallToIso(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) return null
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const matches = new Set<string>()
  for (const offset of candidateOffsets(wallUtc)) {
    const instant = new Date(wallUtc - offset * 60000)
    const wall = wallClock(instant)
    if (
      wall.year === year &&
      wall.month === month &&
      wall.day === day &&
      wall.hour === hour &&
      wall.minute === minute &&
      wall.second === 0
    ) {
      matches.add(instant.toISOString())
    }
  }
  if (matches.size !== 1) return null
  return [...matches][0]
}

export function saoPauloToday(now = new Date()): string {
  const wall = wallClock(now)
  return `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
}

export function saoPauloDateKey(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const wall = wallClock(date)
  return `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`
}

export function formatSaoPauloDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const wall = wallClock(date)
  return `${String(wall.day).padStart(2, '0')}/${String(wall.month).padStart(2, '0')}/${wall.year}`
}

export function formatSaoPauloTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const wall = wallClock(date)
  return `${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}`
}

export function formatSaoPauloDateTime(iso: string): string {
  const dateLabel = formatSaoPauloDate(iso)
  const timeLabel = formatSaoPauloTime(iso)
  if (dateLabel === '—' || timeLabel === '—') return '—'
  return `${dateLabel} ${timeLabel}`
}

export function addMinutesToClock(time: string, minutes: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !Number.isInteger(minutes) || minutes <= 0) return null
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes
  if (total < 0 || total >= 24 * 60) return null
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
