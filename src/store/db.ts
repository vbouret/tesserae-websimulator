import Dexie, { type EntityTable } from 'dexie'
import type { NvsData } from '@/engine/nvs'
import type { SimSettings } from '@/engine/machine'

export interface DeviceRecord {
  id: string
  name: string
  profileId: string
  nvs: NvsData
  settings: SimSettings
  speed: number
  fastPaint: boolean
}

class SimDb extends Dexie {
  devices!: EntityTable<DeviceRecord, 'id'>
  constructor() {
    super('tesserae-websimulator')
    this.version(1).stores({ devices: 'id' })
  }
}

export const db = new SimDb()
