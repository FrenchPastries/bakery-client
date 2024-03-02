import * as mf from '@frenchpastries/millefeuille'
import { internalError } from '@frenchpastries/millefeuille/response'
import * as assemble from '@frenchpastries/assemble'
import { RegisterService } from './register-service'
import { Options } from './types'
import { Heartbeat, Heartbeats, Interface } from '@frenchpastries/bakery'
import * as helpers from './helpers'

export const REST = 'REST'

const heartbeatResponse = (uuid?: string) => {
  if (!uuid) return internalError('UUID not found')
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid }),
  }
}

const warnForEmptySegment = (prefix: string[], key: string, input?: string | number) => {
  if (!input && process.env.NODE_ENV === 'development') {
    const err = new Error()
    console.warn(
      `[Customer]: You didn’t provide a variable for "${key}" segment path. This would create unexpected behavior on the server. We used "${key}" to fill the empty segment. For information, it’s on the "/${prefix.join(
        '/'
      )}/:${key}" path.\nStacktrace:`,
      err.stack
    )
  }
}

type UnifiedPaths = { [path: string]: Set<string> }
const unifyPaths = (restInterface: Interface['value']): UnifiedPaths => {
  const init: UnifiedPaths = {}
  return restInterface.reduce((acc, { method, path }) => {
    const methods = acc[path] ?? new Set()
    return { ...acc, [path]: methods.add(method) }
  }, init)
}

type AllPaths = { [pathSegment: string]: AllPaths | Set<string> }
const constructMethod = (methods: Set<string>, splitted: string[], acc: AllPaths): AllPaths | Set<string> => {
  if (splitted.length === 0) {
    return methods
  } else {
    const segment = splitted[0]
    // The only case where the value of internalSegments is Set<string> is when
    //  segments === ''. Thus, it marks the end of splitted, and will return the
    //  methods in the next recursive call.
    const internalSegments = (acc[segment] ?? {}) as AllPaths
    const method = constructMethod(methods, splitted.slice(1), internalSegments)
    return { ...acc, [segment]: method }
  }
}

const groupByPrefix = (unifiedPaths: UnifiedPaths) => {
  return Object.entries(unifiedPaths).reduce((acc, [path, methods]) => {
    const splitted = path.slice(1).split('/')
    return constructMethod(methods, splitted, acc) as AllPaths
  }, {} as AllPaths)
}

const extractFirstInstanceURL = (instances: Heartbeat['instances']) => {
  if (instances.length === 0) {
    const errorMessage = 'No instances… We shouldn’t be there. Probably a problem with the Bakery.'
    throw new Error(errorMessage)
  } else {
    const { address } = instances[0]
    if (address.startsWith('http')) {
      return address
    } else {
      return `http://${address}`
    }
  }
}

const generateFetchFunction = (method: string, instances: Heartbeat['instances'], prefix: string[]) => {
  const baseURL = extractFirstInstanceURL(instances)
  const endPath = prefix.join('/')
  const url = `${baseURL}/${endPath}`
  return (options?: Omit<RequestInit, 'method'>) => fetch(url, { ...options, method })
}

type Fetcher = (options: Omit<RequestInit, 'method'>) => Promise<Response>
type Fetchers = { [method: string]: Fetcher }
const generateFetchFunctions = (methods: Set<string>, instances: Heartbeat['instances'], prefix: string[]) => {
  const init: Fetchers = {}
  const methods_ = [...methods].map((method) => method.toLowerCase())
  return methods_.reduce((acc, method) => {
    return { ...acc, [method]: generateFetchFunction(method, instances, prefix) }
  }, init)
}

const generateFetchPath = (fetchPath: string[], segment: string, input?: string | number) => {
  if (!segment.startsWith(':')) return [...fetchPath, segment]
  const correctSegment = segment.slice(1)
  warnForEmptySegment(fetchPath, correctSegment, input)
  return [...fetchPath, input?.toString() ?? correctSegment]
}

type ServicesRequests = { [segmentOrMethod: string]: (() => ServicesRequests) | Fetcher }
const genFunctionsInterface = (
  groupedByPrefix: AllPaths,
  instances: Heartbeat['instances'],
  fetchPath: string[] = []
): ServicesRequests => {
  const init: ServicesRequests = {}
  return Object.entries(groupedByPrefix).reduce((acc, [segment, methods]) => {
    if (segment === '') {
      const meths = methods as Set<string>
      const functions = generateFetchFunctions(meths, instances, fetchPath)
      return { ...acc, ...functions }
    } else {
      const meths = methods as AllPaths
      const functionName = helpers.strings.camelize(segment.replace(/^:/, ''))
      return {
        ...acc,
        [functionName]: (input?: string | number) => {
          const finalFetchPath = generateFetchPath(fetchPath, segment, input)
          return genFunctionsInterface(meths, instances, finalFetchPath)
        },
      }
    }
  }, init)
}

const generateServiceAPI = ({ api, instances }: Heartbeat) => {
  switch (api.type) {
    case REST: {
      const unifiedPaths = unifyPaths(api.value)
      const groupedByPrefix = groupByPrefix(unifiedPaths)
      const finalInterface = genFunctionsInterface(groupedByPrefix, instances)
      return finalInterface
    }
    default:
      return {}
  }
}

const generateServicesAPI = (interfaces: Heartbeats) => {
  const init: { [serviceName: string]: ServicesRequests } = {}
  return Object.entries(interfaces).reduce((acc, [serviceName, interface_]) => {
    return { ...acc, [serviceName]: generateServiceAPI(interface_) }
  }, init)
}

const pingOrHandle = (
  glob: { interfaces: string; services: {} },
  handler: mf.Handler<mf.IncomingRequest, any>,
  request: mf.IncomingRequest,
  registryService: RegisterService
) => {
  if (request.location?.pathname === '/heartbeat') {
    registryService.updateLastHeartbeat()
    if (request.body !== glob.interfaces) {
      glob.interfaces = request.body
      const interfaces: Heartbeats = JSON.parse(glob.interfaces)
      glob.services = generateServicesAPI(interfaces)
    }
    return heartbeatResponse(registryService.uuid)
  }
  if (Object.keys(glob.services).length === 0) return internalError('No services')
  request.services = glob.services
  return handler(request)
}

const responsePingOrHandle = (registryService: RegisterService): assemble.Middleware => {
  const glob = { interfaces: '', services: {} }
  return (handler) => {
    registryService.register()
    return async (request) => {
      if (registryService.isConnected) {
        return pingOrHandle(glob, handler, request, registryService)
      } else {
        console.error('Disconnected')
        return internalError('Unable to register to Registry')
      }
    }
  }
}

export const register = (options: Options) => {
  const registryService = new RegisterService(options)
  return responsePingOrHandle(registryService)
}
