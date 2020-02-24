const fetch = require('node-fetch')

const RegisterService = require('./RegisterService')

const pingResponse = uuid => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(uuid),
})

const warnForEmptySegment = (input, key, prefix) => {
  if (!input && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[Customer]: You didn’t provide a variable for "${key}" segment path. This would create unexpected behavior on the server. We used "${key}" to fill the empty segment. For information, it’s on the "/${prefix.join(
        '/'
      )}/:${key}" path.`
    )
  }
}

const unifyPaths = restInterface => {
  return Object.entries(restInterface).reduce((acc, [verb, paths]) => {
    return paths.reduce((newAcc, path) => {
      const verbs = newAcc[path] || new Set()
      return { ...newAcc, [path]: verbs.add(verb) }
    }, acc)
  }, {})
}

const constructVerb = (verbs, splitted, acc = {}) => {
  if (splitted.length === 0) {
    return verbs
  } else {
    const segment = splitted[0]
    const methods = acc[segment] || {}
    const verb = constructVerb(verbs, splitted.slice(1), methods)
    return { ...acc, [segment]: verb }
  }
}

const groupByPrefix = unifiedPaths => {
  return Object.entries(unifiedPaths).reduce((acc, [path, verbs]) => {
    const splitted = path.slice(1).split('/')
    return constructVerb(verbs, splitted, acc)
  }, {})
}

const extractFirstInstanceURL = instances => {
  if (instances.length === 0) {
    const errorMessage =
      'No instances… We shouldn’t be there. Probably a problem with the Bakery.'
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

const generateFetchFunction = (method, instances, prefix) => options => {
  const baseURL = extractFirstInstanceURL(instances)
  const endPath = prefix.join('/')
  const url = `${baseURL}/${endPath}`
  return fetch(url, { ...options, method })
}

const generateFetchFunctions = (methods, instances, prefix) => {
  const verbs = [...methods].map(verb => verb.toLowerCase())
  return verbs.reduce((acc, verb) => {
    return { ...acc, [verb]: generateFetchFunction(verb, instances, prefix) }
  }, {})
}

const generateFetchPath = (fetchPath, input, segment) => {
  if (segment.startsWith(':')) {
    const correctSegment = segment.slice(1)
    warnForEmptySegment(input, correctSegment, fetchPath)
    return [...fetchPath, input || correctSegment]
  } else {
    return [...fetchPath, segment]
  }
}

function camelize(text) {
  return text.replace(/^([A-Z])|[\s-_]+(\w)/g, function(match, p1, p2) {
    if (p2) {
      return p2.toUpperCase()
    }
    return p1.toLowerCase()
  })
}

const camelizeSegment = segment => {
  return camelize(segment.replace(/^:/, ''))
}

const genFunctionsInterface = (groupedByPrefix, instances, fetchPath = []) => {
  return Object.entries(groupedByPrefix).reduce((acc, [segment, methods]) => {
    if (segment === '') {
      const functions = generateFetchFunctions(methods, instances, fetchPath)
      return { ...acc, ...functions }
    } else {
      return {
        ...acc,
        [camelizeSegment(segment)]: input => {
          const finalFetchPath = generateFetchPath(fetchPath, input, segment)
          return genFunctionsInterface(methods, instances, finalFetchPath)
        },
      }
    }
  }, {})
}

const generateServiceAPIHelp = (restInterface, instances) => {
  const unifiedPaths = unifyPaths(restInterface)
  const groupedByPrefix = groupByPrefix(unifiedPaths)
  const finalInterface = genFunctionsInterface(groupedByPrefix, instances)
  return finalInterface
}

const generateServiceAPI = ({ type, value, instances }) => {
  switch (type) {
    case 'REST':
      return generateServiceAPIHelp(value, instances)
    case 'GraphQL':
      return {}
    default:
      return {}
  }
}

const generateServicesAPI = interfaces => {
  return Object.entries(interfaces).reduce((acc, [serviceName, interface_]) => {
    return { ...acc, [serviceName]: generateServiceAPI(interface_) }
  }, {})
}

const pingOrHandle = (glob, handler, request, uuid) => {
  const { url, body } = request
  if (url.pathname === '/heartbeat') {
    if (body !== glob.interfaces) {
      glob.interfaces = body
      glob.services = generateServicesAPI(JSON.parse(glob.interfaces))
    }
    return pingResponse(uuid)
  } else {
    const services = glob.services
    const newRequest = { ...request, services }
    return handler(newRequest)
  }
}

const responseError = error => {
  console.error(error)
  return {
    statusCode: 500,
    body: 'Unable to register to Registry.',
  }
}

const responsePingOrHandle = registryService => {
  const glob = {
    interfaces: {},
    services: {},
  }
  return handler => request => {
    if (registryService.isConnected()) {
      return pingOrHandle(glob, handler, request, registryService.uuid())
    } else {
      return responseError('Disconnected')
    }
  }
}

const register = options => {
  const registryService = new RegisterService(options)
  return responsePingOrHandle(registryService)
}

module.exports = {
  register,
}
