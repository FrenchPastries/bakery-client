# Bakery-client

To register on a [`@FrenchPastries/bakery`](https://github.com/FrenchPastries/bakery).

# Getting Started

Getting started with Bakery Client is simple and easy. It assumes you’re already using [a French Pastries MilleFeuille](https://github.com/FrenchPastries/millefeuille).

```bash
# For Yarn users
yarn add  @frenchpastries/customer
```

```bash
# For NPM users
npm install --save @frenchpastries/customer
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
const MilleFeuille = require('@frenchpastries/millefeuille')
const { get, ...Assemble } = require('@frenchpastries/assemble')
const client = require('@frenchpastries/customer')

const allRoutes = Assemble.routes([
  get('/', () => ({ statusCode: 200 })),
])

const bakeryMiddleware = client.register({
  hostname: process.env.REGISTRY_HOST,
  port: process.env.REGISTRY_PORT,
  serviceInfos: allRoutes.exportRoutes(),
})

MilleFeuille.create(
  bakeryMiddleware(allRoutes)
)
```

## Calling an external service

Let’s imagine you have two services connected to your Bakery, like a payment service, and data management service. You’re building the data management service, but, dammit, you need to ask the payment service to verify the credit card number given by the user.  
That’s fine, you planned all of this, and created the payment service using MilleFeuille and Assemble. Cool, moreover you registered the service using customer in both case. Perfect!

The API for the payment service is like this:

```javascript
const allRoutes = Assemble.routes([
  get('/credit-card/:number/check', handler),
])
```

You can just do this:

```javascript
const myHandler = async request => {
  const response = await request.services.Payment.creditCard().number('0000000000000000').check().get()
  // Do your stuff.
}
```

Under the hood, `node-fetch` is used, so you can expect to use the exact same API as fetch!
