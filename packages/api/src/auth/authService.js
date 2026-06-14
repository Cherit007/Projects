import { account, ID } from '../appwrite/client.js';

export const authService = {
  async getCurrentUser() {
    try {
      return await account.get();
    } catch {
      return null;
    }
  },

  async login(email, password) {
    await account.createEmailPasswordSession(email, password);
    return account.get();
  },

  async register(name, email, password) {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    return account.get();
  },

  async logout() {
    await account.deleteSession('current');
  },

  async updateName(name) {
    await account.updateName(name);
    return account.get();
  },
};
