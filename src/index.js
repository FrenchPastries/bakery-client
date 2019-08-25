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

const generateServiceAPIHelp = value => {
  return Object.entries(value).reduce((acc, [ verb, paths ]) => {
    return paths.reduce((acc, path) => {
      return acc
    }, acc)
  }, {})
}

const generateServiceAPI = ({ type, value }) => {
  switch(type) {
    case 'REST': return generateServiceAPIHelp(value)
    case 'GraphQL': return {}
    default: return {}
  }
}

const generateServicesAPI = interfaces => {
  return Object.entries(interfaces).reduce((acc, [ serviceName, interface_ ]) => {
    return {
      ...acc,
      [serviceName]: generateServiceAPI(interface_),
    }
  }, {})
}

const pingOrHandle = (glob, handler, request) => uuid => {
  const { url, body } = request
  if (url.pathname === '/heartbeat') {
    if (body !== glob.interfaces) {
      glob.interfaces = body
      glob.services = glob.interfaces // generateServicesAPI(JSON.parse(glob.interfaces))
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
