import { Client, Databases, Storage } from "appwrite";

const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1") 
  .setProject("67cff25f00040f6cf6c2"); 

const storage = new Storage(client);
const databases = new Databases(client);

export { client, databases, storage };
