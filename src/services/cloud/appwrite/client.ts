import 'react-native-url-polyfill/auto';
import { Account, Client, TablesDB } from 'react-native-appwrite';

import { cloudConfig, platformId } from './config';

let services: { client: Client; account: Account; tables: TablesDB } | null = null;

export function appwrite() {
  if (!services) {
    const client = new Client()
      .setEndpoint(cloudConfig.endpoint)
      .setProject(cloudConfig.projectId)
      .setPlatform(platformId());
    services = { client, account: new Account(client), tables: new TablesDB(client) };
  }
  return services;
}
