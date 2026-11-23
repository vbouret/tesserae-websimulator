import type { ButtonSpec, DeviceProfile } from './types'

/** Front-button presets, in physical order. Wire names are what the firmware reports. */
const left: ButtonSpec = { name: 'left', label: '◀', cap: 'bg-zinc-200 text-zinc-700' }
const right: ButtonSpec = { name: 'right', label: '▶', cap: 'bg-zinc-200 text-zinc-700' }
const refresh: ButtonSpec = { name: 'refresh', label: '⟳', cap: 'bg-emerald-500 text-white' }
const e1001Buttons = [left, right, refresh]
const navigationButtons = [left, right]
const refreshButton = [refresh]
const rightButton = [right]

const lipo = { minMv: 3300, maxMv: 4200 }
const nimh = { minMv: 4200, maxMv: 5600 }

/** Defaults: 800×480 landscape mono panel, no buttons, no environmental sensor. */
function board(
  id: string,
  label: string,
  kind: string,
  idPrefix: string,
  options: Partial<DeviceProfile> = {},
): DeviceProfile {
  return {
    id,
    label,
    kind,
    idPrefix,
    panelW: 800,
    panelH: 480,
    rotation: 0,
    format: 'mono1',
    buttons: [],
    battery: lipo,
    ...options,
  }
}

const largeSpectra = { panelW: 1200, panelH: 1600, format: 'spectra6' } as const
const spectra = { format: 'spectra6' } as const
const largeGray = { panelW: 1872, panelH: 1404, format: 'gray4' } as const
const smallGray = { panelW: 960, panelH: 540, format: 'gray4' } as const

export const boards: DeviceProfile[] = [
  board('e1001', 'Seeed reTerminal E1001 (mono)', 'seeed_reterminal_e1001', 'reTerminal_E1001', {
    buttons: e1001Buttons,
    envSensor: 'sht4x',
  }),
  board(
    'e1001-gray',
    'Seeed reTerminal E1001 (4-gray)',
    'seeed_reterminal_e1001_gray',
    'reTerminal_E1001',
    { format: 'gray2', buttons: e1001Buttons, envSensor: 'sht4x' },
  ),
  board(
    'e1002',
    'Seeed reTerminal E1002 (Spectra 6)',
    'seeed_reterminal_e1002',
    'reTerminal_E1002',
    {
      ...spectra,
      buttons: e1001Buttons,
      envSensor: 'sht4x',
    },
  ),
  board('e1003', 'Seeed reTerminal E1003 (16-gray)', 'seeed_reterminal_e1003', 'reTerminal_E1003', {
    ...largeGray,
    buttons: e1001Buttons,
    envSensor: 'sht4x',
  }),
  board(
    'e1004',
    'Seeed reTerminal E1004 (Spectra 6)',
    'seeed_reterminal_e1004',
    'reTerminal_E1004',
    { ...largeSpectra, buttons: e1001Buttons, envSensor: 'sht4x' },
  ),
  board('seeed-ee02', 'Seeed XIAO ePaper Kit EE02', 'seeed_ee02', 'Seeed_EE02', {
    ...largeSpectra,
    buttons: e1001Buttons,
  }),
  board(
    'gooddisplay-esp32-133c02',
    'Good Display ESP32-133C02',
    'gooddisplay_esp32_133c02',
    'GoodDisplay_ESP32_133C02',
    { ...largeSpectra, buttons: e1001Buttons },
  ),
  board(
    'soldered-inkplate-13spectra',
    'Soldered Inkplate 13SPECTRA',
    'soldered_inkplate_13spectra',
    'Soldered_Inkplate_13SPECTRA',
    { ...largeSpectra, buttons: refreshButton },
  ),
  board('huessen-epf1301', 'Huessen EPF1301', 'huessen_epf1301', 'Huessen_EPF1301', {
    ...largeSpectra,
    buttons: refreshButton,
  }),
  board(
    'elecrow-crowpanel-579',
    'Elecrow CrowPanel 5.79"',
    'elecrow_crowpanel_579',
    'CrowPanel_579',
    { panelW: 792, panelH: 272, buttons: e1001Buttons },
  ),
  board('seeed-ee03', 'Seeed XIAO ePaper Board EE03', 'seeed_ee03', 'Seeed_EE03', {
    ...largeGray,
    buttons: e1001Buttons,
    envSensor: 'sht4x',
  }),
  board('xiao-epaper-75', 'TRMNL 7.5" OG DIY Kit', 'xiao_epaper_75', 'XIAO_ePaper_75'),
  board('xiao-epaper-75-bwr', 'XIAO 7.5" black/white/red', 'xiao_epaper_75_bwr', 'XIAO_ePaper_75', {
    format: 'bwr',
  }),
  board('seeed-ee04-75', 'Seeed EE04 7.5" mono', 'seeed_ee04_75', 'Seeed_EE04_75', {
    buttons: e1001Buttons,
  }),
  board('seeed-ee04-73e6', 'Seeed EE04 7.3" Spectra 6', 'seeed_ee04_73e6', 'Seeed_EE04_73E6', {
    ...spectra,
    buttons: e1001Buttons,
  }),
  board('seeed-ee05-426', 'Seeed EE05 4.26" mono', 'seeed_ee05_426', 'Seeed_EE05_426', {
    buttons: e1001Buttons,
  }),
  board(
    'waveshare-133e6',
    'Waveshare ESP32-S3-ePaper-13.3E6',
    'waveshare_133e6',
    'Waveshare_133E6',
    largeSpectra,
  ),
  board(
    'waveshare-1085g',
    'Waveshare 10.85" e-Paper HAT+ (G)',
    'waveshare_1085g',
    'Waveshare_1085G',
    { panelW: 1360, panelH: 480, format: 'bwry' },
  ),
  board(
    'paperlesspaper-openpaper-7',
    'paperlesspaper OpenPaper 7',
    'paperlesspaper_openpaper_7',
    'OpenPaper_7',
    { ...spectra, battery: nimh },
  ),
  board(
    'paperlesspaper-openpaper-l',
    'paperlesspaper OpenPaper L',
    'paperlesspaper_openpaper_l',
    'OpenPaper_L',
    { ...largeSpectra, battery: nimh },
  ),
  board(
    'waveshare-photopainter-73',
    'Waveshare PhotoPainter 7.3"',
    'waveshare_photopainter_73',
    'PhotoPainter_73',
    { ...spectra, envSensor: 'shtc3' },
  ),
  board(
    'waveshare-esp32-driver-75',
    'Waveshare ESP32 Driver Board 7.5"',
    'waveshare_esp32_driver_75',
    'Waveshare_ESP32_Driver_75',
  ),
  board(
    'waveshare-esp32s3-hat-75',
    'Waveshare ESP32-S3 7.5" HAT',
    'waveshare_esp32_driver_75',
    'Waveshare_ESP32S3_HAT_75',
  ),
  board(
    'waveshare-rlcd-42',
    'Waveshare ESP32-S3-RLCD-4.2',
    'waveshare_rlcd_42',
    'Waveshare_RLCD_42',
    { panelW: 400, panelH: 300, buttons: rightButton, envSensor: 'shtc3' },
  ),
  board('m5stack-papers3', 'M5Stack PaperS3', 'm5stack_papers3', 'M5PaperS3', {
    ...smallGray,
    rotation: 90,
  }),
  board('m5stack-paperdiy', 'M5Stack PaperDIY', 'm5stack_paperdiy', 'M5PaperDIY', {
    ...smallGray,
    buttons: navigationButtons,
  }),
  board(
    'lilygo-t5s3-pro',
    'LILYGO T5 S3 Pro / Pro Lite',
    'lilygo_t5s3_pro',
    'LilyGoT5S3Pro',
    smallGray,
  ),
  board('m5stack-m5paper', 'M5Stack M5Paper', 'm5stack_m5paper', 'M5Paper', {
    ...smallGray,
    buttons: e1001Buttons,
    envSensor: 'sht3x',
  }),
  board('m5stack-papermono', 'M5Stack PaperMono', 'm5stack_papermono', 'PaperMono', {
    panelW: 480,
    panelH: 800,
    format: 'gray2',
    buttons: navigationButtons,
  }),
  board('xteink-x4', 'Xteink X4', 'xteink_x4', 'Xteink_X4', { buttons: rightButton }),
  board(
    'e1001-gray-legacy',
    'Seeed reTerminal E1001 (4-gray legacy)',
    'seeed_reterminal_e1001_gray_legacy',
    'reTerminal_E1001',
    { format: 'gray2', buttons: e1001Buttons, envSensor: 'sht4x' },
  ),
  board(
    'seeed-reterminal-sticky',
    'Seeed reTerminal Sticky',
    'seeed_reterminal_sticky',
    'reTerminal_Sticky',
    { panelW: 480, panelH: 800, format: 'gray2', buttons: e1001Buttons, envSensor: 'sht4x' },
  ),
  board(
    'xiao-epaper-75-c3',
    'XIAO ePaper Panel 7.5" ESP32-C3',
    'xiao_epaper_panel_75_c3',
    'XIAO_ePaper_Panel_75',
  ),
  board(
    'seeed-ee05',
    'Seeed EE05 2.13" black/white/yellow/red',
    'seeed_ee05_213_bwry',
    'Seeed_EE05_213_BWRY',
    { panelW: 128, panelH: 250, format: 'bwry', buttons: e1001Buttons },
  ),
  board(
    'waveshare-epaper-73f',
    'Waveshare 7.3" e-Paper (F)',
    'waveshare_epaper_73f',
    'Waveshare_73F',
    { format: 'acep7' },
  ),
  board('epdiy-v7-ed133ut2', 'EPDiy V7 ED133UT2', 'epdiy_v7_ed133ut2', 'EPDiy_V7', {
    panelW: 1600,
    panelH: 1200,
    format: 'gray4',
  }),
]
