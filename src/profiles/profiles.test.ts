import { describe, expect, it } from 'vitest'
import { frameBytesFor, getProfile, profiles } from './index'

describe('firmware board profiles', () => {
  it('has a unique selectable profile for every supported device', () => {
    const ids = [
      'e1001',
      'e1001-gray',
      'e1002',
      'e1003',
      'e1004',
      'seeed-ee02',
      'gooddisplay-esp32-133c02',
      'soldered-inkplate-13spectra',
      'huessen-epf1301',
      'elecrow-crowpanel-579',
      'seeed-ee03',
      'xiao-epaper-75',
      'xiao-epaper-75-bwr',
      'seeed-ee04-75',
      'seeed-ee04-73e6',
      'seeed-ee05-426',
      'waveshare-133e6',
      'waveshare-1085g',
      'paperlesspaper-openpaper-7',
      'paperlesspaper-openpaper-l',
      'waveshare-photopainter-73',
      'waveshare-esp32-driver-75',
      'waveshare-esp32s3-hat-75',
      'waveshare-rlcd-42',
      'm5stack-papers3',
      'm5stack-paperdiy',
      'lilygo-t5s3-pro',
      'm5stack-m5paper',
      'm5stack-papermono',
      'xteink-x4',
      'e1001-gray-legacy',
      'seeed-reterminal-sticky',
      'xiao-epaper-75-c3',
      'seeed-ee05',
      'waveshare-epaper-73f',
      'epdiy-v7-ed133ut2',
    ]
    expect(profiles.map((p) => p.id).sort()).toEqual(ids.sort())
    expect(new Set(profiles.map((p) => p.id)).size).toBe(profiles.length)
  })

  it.each([
    ['e1004', 'seeed_reterminal_e1004', 960000],
    ['elecrow-crowpanel-579', 'elecrow_crowpanel_579', 26928],
    ['seeed-ee03', 'seeed_ee03', 1314144],
    ['xiao-epaper-75-bwr', 'xiao_epaper_75_bwr', 96000],
    ['waveshare-1085g', 'waveshare_1085g', 163200],
    ['m5stack-papers3', 'm5stack_papers3', 259200],
    ['m5stack-papermono', 'm5stack_papermono', 96000],
    ['seeed-ee05', 'seeed_ee05_213_bwry', 8000],
    ['epdiy-v7-ed133ut2', 'epdiy_v7_ed133ut2', 960000],
  ])('uses the correct identity and frame size for %s', (id, kind, bytes) => {
    const p = getProfile(id)
    expect(p.kind).toBe(kind)
    expect(frameBytesFor(p)).toBe(bytes)
  })

  it('uses the firmware rotation, button wire names and sensors', () => {
    expect(getProfile('m5stack-papers3').rotation).toBe(90)
    expect(getProfile('m5stack-paperdiy').buttons.map((b) => b.name)).toEqual(['left', 'right'])
    expect(getProfile('xteink-x4').buttons.map((b) => b.name)).toEqual(['right'])
    expect(getProfile('waveshare-esp32s3-hat-75').kind).toBe('waveshare_esp32_driver_75')
    expect(getProfile('m5stack-m5paper').envSensor).toBe('sht3x')
    expect(getProfile('waveshare-photopainter-73').envSensor).toBe('shtc3')
    expect(getProfile('waveshare-133e6').envSensor).toBeUndefined()
  })
})
