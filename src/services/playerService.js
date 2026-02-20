import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';

/**
 * Player Ratings Service
 * Handles ELO ratings and player database
 */

export const playerService = {
  /**
   * Save or update player database (list of player names)
   */
  async savePlayerDatabase(players) {
    try {
      // Check if player database document exists
      const existingDoc = await this.getPlayerDatabase();

      const document = {
        players: JSON.stringify(players),
        updatedAt: new Date().toISOString(),
      };

      if (existingDoc) {
        // Update existing
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.PLAYERS,
          existingDoc.$id,
          document
        );
      } else {
        // Create new
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.PLAYERS,
          ID.unique(),
          document
        );
      }

      return players;
    } catch (error) {
      console.error('Error saving player database:', error);
      throw error;
    }
  },

  /**
   * Get player database
   */
  async getPlayerDatabase() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.PLAYERS,
        [Query.limit(1)]
      );

      if (response.documents.length > 0) {
        const doc = response.documents[0];
        return {
          $id: doc.$id,
          players: JSON.parse(doc.players || '[]'),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching player database:', error);
      throw error;
    }
  },

  /**
   * Save player ratings (ELO)
   */
  async savePlayerRatings(ratings) {
    try {
      // Check if ratings document exists
      const existingDoc = await this.getPlayerRatings();

      const document = {
        ratings: JSON.stringify(ratings),
        updatedAt: new Date().toISOString(),
      };

      if (existingDoc) {
        // Update existing
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.RATINGS,
          existingDoc.$id,
          document
        );
      } else {
        // Create new
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.RATINGS,
          ID.unique(),
          document
        );
      }

      return ratings;
    } catch (error) {
      console.error('Error saving player ratings:', error);
      throw error;
    }
  },

  /**
   * Get player ratings
   */
  async getPlayerRatings() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.RATINGS,
        [Query.limit(1)]
      );

      if (response.documents.length > 0) {
        const doc = response.documents[0];
        return {
          $id: doc.$id,
          ratings: JSON.parse(doc.ratings || '{}'),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching player ratings:', error);
      throw error;
    }
  },

  /**
   * Add player to database
   */
  async addPlayerToDatabase(playerName) {
    try {
      const dbDoc = await this.getPlayerDatabase();
      const players = dbDoc ? dbDoc.players : [];

      if (!players.includes(playerName)) {
        players.push(playerName);
        await this.savePlayerDatabase(players);
      }

      return players;
    } catch (error) {
      console.error('Error adding player:', error);
      throw error;
    }
  },
};