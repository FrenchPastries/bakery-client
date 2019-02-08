# Bakery-client

To register on a `@FrenchPastries/bakery`.

# Getting Started

Getting started with Bakery Client is simple and easy.

```bash
# For Yarn users
yarn add @frenchpastries/bakery-client
```

```bash
# For NPM users
npm install --save @frenchpastries/bakery-client
```

## Interface to register
Service should send a json interface when registering:

```json
{
  "name": "my-service",
  "version": "1.2.3",
  "state": "string",
  "address": "127.0.0.1:1234",
  "interface": {
    "type": "REST || GraphQL",
    "value": "REST routes or GraphQL Schema"
  }
}
```

```javascript
const client = require('bakery-client')

//the uuid given by the bakery to this instance of client

const api = ''

const bakeryMiddleware = client.register({
  hostname: process.env.REGISTRY_HOST,
  port: process.env.REGISTRY_PORT,
  api
})

const allRoutes = Assemble.routes([
  get('/', () => ({ statusCode: 200 }))
])

MilleFeuille.create(bakeryMiddleware(allRoutes))
```
