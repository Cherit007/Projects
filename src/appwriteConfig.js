import { Client, Databases } from "appwrite";

const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1") 
  .setProject("67cff25f00040f6cf6c2"); 

const databases = new Databases(client);

export { client, databases };
