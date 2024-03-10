import type { Service } from '@frenchpastries/bakery'
import type { Options, ServiceInfos } from './types'
import * as helpers from './helpers'
import * as os from 'os'
import EventEmitter from 'events'

export const events = {
  cpuLoad: 'cpu-load',
  connected: 'connected',
  disconnected: 'disconnected',
  heartbeat: 'heartbeat',
} as const
type EventKeys = keyof typeof events
export type Event = (typeof events)[EventKeys]

// Because package.json names can be @org/package-name.
export const lastNamePart = (name?: string) => name?.split('/').pop()

export class RegisterService extends EventEmitter {
  #state: number[] = []
  #serviceInfos: string
  #bakeryURL: string
  #value?: { uuid: string }
  #lastHeartbeat?: number
  #cpuLoadIntervalId?: NodeJS.Timeout
  #connectionIntervalId?: NodeJS.Timeout

  constructor(options: Options = {}) {
    super()
    const hostname = options.bakery?.hostname ?? 'localhost'
    const port = options.bakery?.port ?? 8080
    const customerPort: number | undefined = options.port ?? (process.env.PORT ? +process.env.PORT : undefined)
    if (!options.router && !options.interface) throw new Error('Pass router or interface to customer.')
    if (!customerPort) throw new Error('Port should be defined through options or process.env.PORT.')
    const interface_ = options.interface ?? { type: 'REST', value: options.router!.export() }
    const serviceInfos: ServiceInfos = { interface: interface_, port: customerPort }
    this.#serviceInfos = JSON.stringify(this.#correctServiceInfos(serviceInfos))
    this.#bakeryURL = `http://${hostname}:${port}/register`
  }

  async register() {
    if (this.#connectionIntervalId) return this
    const updateComputeLoad = () => {
      this.#state = helpers.cpus.computeLoad()
      this.emit(events.cpuLoad, this.#state)
    }
    const connect = () => !this.isConnected && this.#connect()
    this.#cpuLoadIntervalId = setInterval(updateComputeLoad, 5000)
    this.#connectionIntervalId = setInterval(connect, 5000)
    await connect()
    updateComputeLoad()
    return this
  }

  async #connect() {
    try {
      const response = await fetch(this.#bakeryURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.#serviceInfos,
      })
      this.#value = await response.json()
      this.#lastHeartbeat = Date.now()
      this.emit(events.connected)
    } catch (error) {
      console.error(error)
      console.error('Unable to connect to Bakery. Reconnection in 5s.')
    }
  }

  updateLastHeartbeat() {
    this.#lastHeartbeat = Date.now()
    this.emit(events.heartbeat)
    return this
  }

  close() {
    clearInterval(this.#connectionIntervalId)
    clearInterval(this.#cpuLoadIntervalId)
    this.#connectionIntervalId = undefined
    return this
  }

  get isConnected() {
    if (!this.#lastHeartbeat) return false
    const current = Date.now()
    const state = current - this.#lastHeartbeat < 5000
    if (!state) this.emit(events.disconnected)
    return state
  }

  get uuid() {
    return this.#value?.uuid
  }

  #correctServiceInfos = (serviceInfos: ServiceInfos): Omit<Service, 'uuid'> => {
    const pjsonContent = helpers.files.findPackageJson()
    const pjsonName = pjsonContent.name as string | undefined
    const pjsonVersion = pjsonContent.version as string | undefined
    const name = serviceInfos.name ?? lastNamePart(pjsonName)
    const version = serviceInfos.version ?? pjsonVersion
    const address = serviceInfos.address ?? `${os.networkInterfaces().en0![1].address}`
    if (!name) throw new Error('No name found in package.json or infos')
    if (!version) throw new Error('No version found in package.json or infos')
    if (!address) throw new Error('No address found')
    return {
      name,
      version,
      state: this.#state,
      address,
      port: serviceInfos.port,
      interface: serviceInfos.interface,
    }
  }
}
