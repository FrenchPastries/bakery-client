# Bakery-client

To register on a @frenchpastries/bakery

# Getting Started

Getting started with MilleFeuille is simple and easy.

```bash
# For Yarn users
yarn add @frenchpastries/bakery-client
```

```bash
# For NPM users
npm install --save @frenchpastries/bakery-client
```


```javascript
const client = require('bakery-client')

//the uuid given by the bakery to this instance of client

client.register(process.env.REGISTERY_HOST, process.env.REGISTERY_PORT, service)
  .then(uuid => console.log(uuid))
//{ uuid: '32142fa4-40e2-46e7-b2c8-c7c7188d4e52' }
```
