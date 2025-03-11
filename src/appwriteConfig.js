import { Client, Databases } from "appwrite";

// 🔥 Initialize Appwrite Client
const client = new Client();
client
  .setEndpoint("https://cloud.appwrite.io/v1") // Replace with your Appwrite endpoint
  .setProject("67cff25f00040f6cf6c2"); // Replace with your project ID

// 🔥 Initialize Database
const databases = new Databases(client);

export { client, databases };
