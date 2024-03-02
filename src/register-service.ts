import type { Service } from '@frenchpastries/bakery'
import type { Options, ServiceInfos } from './types'
import * as helpers from './helpers'

const { HOSTNAME, PORT } = process.env

// Because package.json names can be @org/package-name.
export const lastNamePart = (name?: string) => name?.split('/').pop()

export class RegisterService {
  #state: number[] = []
  #serviceInfos: string
  #bakeryURL: string
  #value?: { uuid: string }
  #lastHeartbeat?: number
  #cpuLoadIntervalId?: NodeJS.Timeout
  #connectionIntervalId?: NodeJS.Timeout

  constructor({ hostname, port, serviceInfos }: Options) {
    this.#serviceInfos = JSON.stringify(this.#correctServiceInfos(serviceInfos))
    this.#bakeryURL = `http://${hostname}:${port}/register`
  }

  register() {
    if (this.#connectionIntervalId) return
    const updateComputeLoad = () => (this.#state = helpers.cpus.computeLoad())
    const connect = () => !this.isConnected && this.#connect()
    this.#cpuLoadIntervalId = setInterval(updateComputeLoad, 5000)
    this.#connectionIntervalId = setInterval(connect, 5000)
    connect()
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
    } catch (error) {
      console.error(error)
      console.error('Unable to connect to Bakery. Reconnection in 5s.')
    }
  }

  updateLastHeartbeat() {
    this.#lastHeartbeat = Date.now()
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
    return current - this.#lastHeartbeat < 5000
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
    if (!name) throw new Error('No name found in package.json or infos')
    if (!version) throw new Error('No version found in package.json or infos')
    if (!serviceInfos.address && !HOSTNAME) throw new Error('No hostname found')
    return {
      name,
      version,
      state: this.#state,
      address: serviceInfos.address ?? HOSTNAME!,
      port: serviceInfos.port ?? PORT,
      interface: serviceInfos.interface,
    }
  }
}
