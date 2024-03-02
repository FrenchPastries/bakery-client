import { Service } from '@frenchpastries/bakery'

export type ServiceInfos = Omit<Service, 'uuid' | 'name' | 'version' | 'state' | 'address'> & {
  name?: string
  version?: string
  address?: string
}

export type Options = {
  hostname: string
  port: number
  serviceInfos: ServiceInfos
}
