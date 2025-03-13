import { Client, Databases, Storage, Account } from "appwrite";

const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("67cff25f00040f6cf6c2");

const storage = new Storage(client);
const databases = new Databases(client);
const account = new Account(client);

export { client, databases, storage, account };
