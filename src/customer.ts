import { ip } from '@frenchpastries/bakery'
import * as mf from '@frenchpastries/millefeuille'
import { internalError } from '@frenchpastries/millefeuille/response'
import * as assemble from '@frenchpastries/assemble'
import { RegisterService, events } from './register-service'
import { Options } from './types'
import { Heartbeat, Heartbeats, Interface } from '@frenchpastries/bakery'
import * as helpers from './helpers'
import DNS from 'dns2'

export const REST = 'REST'

type UnifiedPaths = { [path: string]: Set<string> }
export type Fetcher = (options?: Omit<RequestInit, 'method'>) => Promise<Response>
export type Paths = { [pathSegment: string]: Paths | Set<string> }

type Fetchers = {
  get?: Fetcher
  post?: Fetcher
  put?: Fetcher
  patch?: Fetcher
  delete?: Fetcher
  options?: Fetcher
}

export interface Services {
  [serviceName: string]: any
}

const warnForEmptySegment = (prefix: string[], key: string, input?: string | number) => {
  if (!input && process.env.NODE_ENV === 'development') {
    const err = new Error()
    console.warn(
      `[Customer]: You didn’t provide a variable for "${key}" segment path.`,
      `This would create unexpected behavior on the server. We used "${key}" to fill the empty segment.`,
      `For information, it’s on the "/${prefix.join('/')}/:${key}" path.\nStacktrace:`,
      err.stack
    )
  }
}

const unifyPaths = (restInterface: Interface['value']): UnifiedPaths => {
  const init: UnifiedPaths = {}
  return restInterface.reduce((acc, { method, path }) => {
    const methods = acc[path] ?? new Set()
    return { ...acc, [path]: methods.add(method) }
  }, init)
}

const constructMethod = (methods: Set<string>, splitted: string[], acc: Paths): Paths | Set<string> => {
  if (splitted.length === 0) return methods
  const segment = splitted[0]
  // The only case where the value of internalSegments is Set<string> is when
  //  segments === ''. Thus, it marks the end of splitted, and will return the
  //  methods in the next recursive call.
  const internalSegments = (acc[segment] ?? {}) as Paths
  const method = constructMethod(methods, splitted.slice(1), internalSegments)
  return { ...acc, [segment]: method }
}

const generateFetchPath = (fetchPath: string[], segment: string, input?: string | number) => {
  if (!segment.startsWith(':')) return [...fetchPath, segment]
  const correctSegment = segment.slice(1)
  warnForEmptySegment(fetchPath, correctSegment, input)
  return [...fetchPath, input?.toString() ?? correctSegment]
}

const groupByPrefix = (unifiedPaths: UnifiedPaths) => {
  return Object.entries(unifiedPaths).reduce((acc, [path, methods]) => {
    const splitted = path.slice(1).split('/')
    return constructMethod(methods, splitted, acc) as Paths
  }, {} as Paths)
}

class Customer {
  #registryService: RegisterService
  #services: Services
  #apis: string
  #dnsClient: DNS
  #autoconnect: boolean
  #connectionState: Promise<boolean>
  #unsubscribe: () => void
  #readyWarnings: ((value: boolean) => void)[]

  constructor(registryService: RegisterService, options: Options) {
    this.#registryService = registryService
    this.#connectionState = this.#setConnectionState()
    const onDisconnected = () => (this.#connectionState = this.#setConnectionState())
    this.#registryService.on(events.disconnected, onDisconnected)
    this.#unsubscribe = () => this.#registryService.off(events.disconnected, onDisconnected)
    this.#services = {}
    this.#apis = ''
    this.#readyWarnings = []
    this.#autoconnect = options.autoconnect ?? true
    this.#dnsClient = new DNS({
      nameServers: ['localhost'],
      port: (options.bakery?.port ?? 8080) + 1,
      recursive: false,
    })
  }

  #setConnectionState() {
    return new Promise<boolean>((resolve) => {
      this.#registryService.once(events.connected, () => resolve(true))
    })
  }

  #heartbeatResponse() {
    const uuid = this.#registryService.uuid
    if (!uuid) return internalError('UUID not found')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid }),
    }
  }

  async #selectBaseURL(serviceName: string) {
    if (process.env.NODE_ENV !== 'development') return serviceName
    const packet = await this.#dnsClient.resolve(`${serviceName}.bakery`, 'SRV')
    const answer: any = packet.answers.find((answer) => answer.name === `${serviceName}.bakery`)
    if (!answer) return
    const address = ip.ipv6.enclose(answer.target)
    return `${address}:${answer.port}`
  }

  #generateFetcher = (methods: Set<string>, serviceName: string, prefix: string[]) => {
    const init: Fetchers = {}
    const methods_ = [...methods].map((method) => method.toLowerCase())
    return methods_.reduce((acc, method) => {
      const fetcher = async (options?: Omit<RequestInit, 'method'>) => {
        const baseURL = await this.#selectBaseURL(serviceName)
        if (!baseURL) throw new Error('DNS server not found')
        const endPath = prefix.join('/')
        const url = `http://${baseURL}/${endPath}`
        return fetch(url, { ...options, method })
      }
      return { ...acc, [method]: fetcher }
    }, init)
  }

  #genFunctionsInterface = (
    groupedByPrefix: Paths,
    serviceName: string,
    fetchPath: string[] = []
  ): { [segmentOrMethod: string]: any } => {
    const init: { [segmentOrMethod: string]: any } = {}
    return Object.entries(groupedByPrefix).reduce((acc, [segment, methods]) => {
      if (segment === '') {
        const meths = methods as Set<string>
        const functions = this.#generateFetcher(meths, serviceName, fetchPath)
        return { ...acc, ...functions }
      } else {
        const meths = methods as Paths
        const functionName = helpers.strings.camelize(segment.replace(/^:/, ''))
        return {
          ...acc,
          [functionName]: (input?: string | number) => {
            const finalFetchPath = generateFetchPath(fetchPath, segment, input)
            return this.#genFunctionsInterface(meths, serviceName, finalFetchPath)
          },
        }
      }
    }, init)
  }

  #generateServiceAPI = ({ name, api }: Heartbeat) => {
    switch (api.type) {
      case REST: {
        const unifiedPaths = unifyPaths(api.value)
        const groupedByPrefix = groupByPrefix(unifiedPaths)
        const finalInterface = this.#genFunctionsInterface(groupedByPrefix, name)
        return finalInterface
      }
      default:
        return {}
    }
  }

  #onHeartbeat(request: mf.IncomingRequest) {
    this.#registryService.updateLastHeartbeat()
    if (request.body !== this.#apis) {
      this.#apis = request.body
      const heartbeats: Heartbeats = JSON.parse(this.#apis)
      const init: { [serviceName: string]: {} } = {}
      this.#services = Object.entries(heartbeats).reduce((acc, [serviceName, heartbeat]) => {
        return { ...acc, [serviceName]: this.#generateServiceAPI(heartbeat) }
      }, init)
    }
    this.#readyWarnings.forEach((resolve) => resolve(true))
    this.#readyWarnings = []
    return this.#heartbeatResponse()
  }

  #pingOrHandle(handler: mf.Handler<mf.IncomingRequest, any>, request: mf.IncomingRequest) {
    if (request.location?.pathname === '/heartbeat') return this.#onHeartbeat(request)
    if (Object.keys(this.#services).length === 0) return internalError('No services')
    return handler(request)
  }

  get services() {
    return this.#services
  }

  async connect() {
    await this.#registryService.register()
    return this
  }

  get isConnected() {
    return this.#registryService.isConnected
  }

  async ready() {
    const fiveSecondsWait = new Promise((_, r) => setTimeout(() => r(false), 30_000))
    const waitForServices = () => {
      if (Object.keys(this.#services).length > 0) return true
      return new Promise<boolean>((resolve) => this.#readyWarnings.push(resolve))
    }
    return Promise.race([fiveSecondsWait, this.#connectionState.then(waitForServices)])
  }

  middleware: assemble.Middleware = (handler) => {
    if (this.#autoconnect) this.connect()
    return async (request) => {
      if (this.isConnected) {
        return this.#pingOrHandle(handler, request)
      } else if (!this.#autoconnect) {
        return handler(request)
      } else {
        console.error('Disconnected')
        return internalError('Unable to register to Registry')
      }
    }
  }

  destroy() {
    return this.#unsubscribe()
  }
}

/** Register a service to a bakery, and provides an object containing
 * the services and the middleware. */
export const register = (options: Options): Customer => {
  const registryService = new RegisterService(options)
  const customer = new Customer(registryService, options)
  return customer
}

/** Read an returns the interfaces for the services connected to the bakery
 * at the `url`. */
export const interfaces = async (url: string) => {
  const response = await fetch(url + '/services')
  const apis: Heartbeats = await response.json()
  const init: { [serviceName: string]: Paths } = {}
  return Object.entries(apis).reduce((acc, [serviceName, { api }]) => {
    const unifiedPaths = unifyPaths(api.value)
    const groupedByPrefix = groupByPrefix(unifiedPaths)
    return { ...acc, [serviceName]: groupedByPrefix }
  }, init)
}
