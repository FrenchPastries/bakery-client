const fetch = require('node-fetch')

const registerService = async ({ hostname, port, serviceInfos }) => {
  const bakeryURL = `http://${hostname}:${port}/register`
  const response = await fetch(bakeryURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serviceInfos),
  })
  const value = await response.json()
  return value
}

const pingResponse = uuid => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(uuid),
})

const warnForEmptySegment = (input, key, prefix) => {
  if (!input && process.env.NODE_ENV !== 'production') {
    console.warn(`[Customer]: You didn’t provide a variable for "${key}" segment path. This would create unexpected behavior on the server. We used "${key}" to fill the empty segment. For information, it’s on the "/${prefix.join('/')}/:${key}" path.`)
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
    return { ...acc, [segment]: constructVerb(verbs, splitted.slice(1), methods) }
  }
}

const groupByPrefix = unifiedPaths => {
  return Object.entries(unifiedPaths).reduce((acc, [path, verbs]) => {
    const splitted = path.slice(1).split('/')
    return constructVerb(verbs, splitted, acc)
  }, {})
}

const generateFetchFunction = (method, prefix) => options => {
  const url = '/' + prefix.join('/')
  return fetch(url, { ...options, method })
}

const generateFetchFunctions = (methods, prefix) => {
  const verbs = [...methods].map(verb => verb.toLowerCase())
  return verbs.reduce((acc, verb) => {
    return { ...acc, [verb]: generateFetchFunction(verb, prefix) }
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

const generateFunctionsInterface = (groupedByPrefix, fetchPath = []) => {
  return Object.entries(groupedByPrefix).reduce((acc, [segment, methods]) => {
    if (segment === '') {
      const functions = generateFetchFunctions(methods, fetchPath)
      return { ...acc, ...functions }
    } else {
      return { ...acc, [segment.replace(/^:/, '')]: input => {
        const finalFetchPath = generateFetchPath(fetchPath, input, segment)
        return generateFunctionsInterface(methods, finalFetchPath)
      } }
    }
  }, {})
}

const generateServiceAPIHelp = restInterface => {
  const unifiedPaths = unifyPaths(restInterface)
  const groupedByPrefix = groupByPrefix(unifiedPaths)
  const finalInterface = generateFunctionsInterface(groupedByPrefix)
  return finalInterface
}

const generateServiceAPI = ({ type, value }) => {
  switch(type) {
    case 'REST': return generateServiceAPIHelp(value)
    case 'GraphQL': return {}
    default: return {}
  }
}

const generateServicesAPI = interfaces => {
  return Object.entries(interfaces).reduce((acc, [serviceName, interface_]) => {
    return { ...acc, [serviceName]: generateServiceAPI(interface_) }
  }, {})
}

const pingOrHandle = (glob, handler, request) => uuid => {
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

const responsePingOrHandle = registering => {
  const glob = {
    interfaces: {},
    services: {},
  }
  return handler => request => {
    return registering
      .then(pingOrHandle(glob, handler, request))
      .catch(responseError)
  }
}

const register = options => {
  const registering = registerService(options)
  return responsePingOrHandle(registering)
}

module.exports = {
  register,
}
