import { describe, expect, it } from 'vitest'
import {
  addMinutesToClock,
  formatSaoPauloDateTime,
  formatSaoPauloTime,
  nextCalendarDay,
  saoPauloWallToIso,
} from '../src/lib/saoPauloTime'

describe('America/Sao_Paulo clock', () => {
  it('converts a wall-clock time to the matching UTC instant', () => {
    expect(saoPauloWallToIso('2026-10-10', '10:00')).toBe('2026-10-10T13:00:00.000Z')
    expect(saoPauloWallToIso('2026-10-10', '11:00')).toBe('2026-10-10T14:00:00.000Z')
    expect(formatSaoPauloTime('2026-10-10T13:00:00.000Z')).toBe('10:00')
    expect(formatSaoPauloDateTime('2026-10-10T13:00:00.000Z')).toBe('10/10/2026 10:00')
  })

  it('keeps adjacent hours on the same Sao Paulo day', () => {
    const firstEnd = saoPauloWallToIso('2026-10-10', '11:00')
    const secondStart = saoPauloWallToIso('2026-10-10', '11:00')
    expect(firstEnd).toBe(secondStart)
    expect(nextCalendarDay('2026-10-10')).toBe('2026-10-11')
    expect(saoPauloWallToIso('2026-10-11', '00:00')).toBe('2026-10-11T03:00:00.000Z')
  })

  it('rejects an impossible clock and a duration that leaves the day', () => {
    expect(saoPauloWallToIso('2026-02-31', '10:00')).toBeNull()
    expect(saoPauloWallToIso('2026-10-10', '24:00')).toBeNull()
    expect(addMinutesToClock('23:30', 60)).toBeNull()
    expect(addMinutesToClock('10:00', 90)).toBe('11:30')
  })

  it('resolves a unique historical instant and rejects a gap or a repeated hour', () => {
    expect(saoPauloWallToIso('2018-11-04', '01:00')).toBe('2018-11-04T03:00:00.000Z')
    expect(formatSaoPauloDateTime('2018-11-04T03:00:00.000Z')).toBe('04/11/2018 01:00')
    expect(saoPauloWallToIso('2018-02-18', '00:00')).toBe('2018-02-18T03:00:00.000Z')
    expect(saoPauloWallToIso('2018-11-04', '00:00')).toBeNull()
    expect(saoPauloWallToIso('2018-02-17', '23:00')).toBeNull()
  })
})
