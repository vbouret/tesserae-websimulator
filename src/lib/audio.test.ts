import { expect, it } from 'vitest'
import { parsePattern } from './audio'

it('parses beep patterns', () => {
  expect(parsePattern('880:100,0:50, 440:200')).toEqual([
    { freq: 880, ms: 100 },
    { freq: 0, ms: 50 },
    { freq: 440, ms: 200 },
  ])
  expect(parsePattern('junk')).toEqual([])
})
