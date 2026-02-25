import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';

/**
 * Tournament Service
 * Handles all tournament-related database operations
 */

export const tournamentService = {
  /**
   * Create a new tournament
   */
  async createTournament(tournamentData) {
    try {
      const document = {
        name: tournamentData.name,
        date: tournamentData.date,
        teams: JSON.stringify(tournamentData.teams),
        fixtures: JSON.stringify(tournamentData.fixtures || []),
        bracket: tournamentData.bracket ? JSON.stringify(tournamentData.bracket) : null,
        finalMatch: tournamentData.finalMatch ? JSON.stringify(tournamentData.finalMatch) : null,
        champion: tournamentData.champion ? JSON.stringify(tournamentData.champion) : null,
        aiSummaries: JSON.stringify(tournamentData.aiSummaries || []),
        format: tournamentData.format || '1',
        gameMode: tournamentData.gameMode || 'doubles',
        tournamentFormat: tournamentData.tournamentFormat || 'league',
        status: tournamentData.status || 'active', // active, completed
        createdAt: new Date().toISOString(),
      };

      const response = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS,
        ID.unique(),
        document
      );

      return this.parseTournament(response);
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw error;
    }
  },

  /**
   * Get all tournaments for current user
   */
  async getAllTournaments(limit = 100) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS,
        [
          Query.orderDesc('createdAt'),
          Query.limit(limit),
        ]
      );

      return response.documents.map(doc => this.parseTournament(doc));
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      throw error;
    }
  },

  /**
   * Get tournament by ID
   */
  async getTournamentById(tournamentId) {
    try {
      const response = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS,
        tournamentId
      );

      return this.parseTournament(response);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      throw error;
    }
  },

  /**
   * Update tournament
   */
  async updateTournament(tournamentId, updates) {
    try {
      const document = {};
      
      if (updates.name !== undefined) document.name = updates.name;
      if (updates.teams !== undefined) document.teams = JSON.stringify(updates.teams);
      if (updates.fixtures !== undefined) document.fixtures = JSON.stringify(updates.fixtures);
      if (updates.bracket !== undefined) document.bracket = updates.bracket ? JSON.stringify(updates.bracket) : null;
      if (updates.finalMatch !== undefined) document.finalMatch = updates.finalMatch ? JSON.stringify(updates.finalMatch) : null;
      if (updates.champion !== undefined) document.champion = updates.champion ? JSON.stringify(updates.champion) : null;
      if (updates.aiSummaries !== undefined) document.aiSummaries = JSON.stringify(updates.aiSummaries || []);
      if (updates.status !== undefined) document.status = updates.status;
      if (updates.format !== undefined) document.format = updates.format;
      if (updates.gameMode !== undefined) document.gameMode = updates.gameMode;
      if (updates.tournamentFormat !== undefined) document.tournamentFormat = updates.tournamentFormat;

      const response = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS,
        tournamentId,
        document
      );

      return this.parseTournament(response);
    } catch (error) {
      console.error('Error updating tournament:', error);
      throw error;
    }
  },

  /**
   * Delete tournament
   */
  async deleteTournament(tournamentId) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS,
        tournamentId
      );
      return true;
    } catch (error) {
      console.error('Error deleting tournament:', error);
      throw error;
    }
  },

  /**
   * Parse tournament document from Appwrite
   */
  parseTournament(doc) {
    return {
      id: doc.$id,
      name: doc.name,
      date: doc.date,
      teams: JSON.parse(doc.teams || '[]'),
      fixtures: JSON.parse(doc.fixtures || '[]'),
      bracket: doc.bracket ? JSON.parse(doc.bracket) : null,
      finalMatch: doc.finalMatch ? JSON.parse(doc.finalMatch) : null,
      champion: doc.champion ? JSON.parse(doc.champion) : null,
      aiSummaries: JSON.parse(doc.aiSummaries || '[]'),
      format: doc.format,
      gameMode: doc.gameMode,
      tournamentFormat: doc.tournamentFormat,
      status: doc.status,
      createdAt: doc.createdAt,
      appwriteId: doc.$id, // Keep reference to Appwrite document ID
    };
  },
};
