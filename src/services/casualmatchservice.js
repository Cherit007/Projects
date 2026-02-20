import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';

/**
 * Casual Match Service
 * Handles individual match recording outside of tournaments
 */

export const casualMatchService = {
  /**
   * Create a casual match record
   */
  async createCasualMatch(matchData) {
    try {
      const document = {
        matchType: matchData.matchType,
        date: matchData.date || new Date().toISOString(),
        team1: JSON.stringify(matchData.team1),
        team2: JSON.stringify(matchData.team2),
        score1: String(matchData.score1),  // ✅ Convert to string
        score2: String(matchData.score2),  // ✅ Convert to string
        winner: matchData.winner,
        createdAt: new Date().toISOString(),
      };
  
      const response = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.CASUAL_MATCHES,
        ID.unique(),
        document
      );
  
      return this.parseCasualMatch(response);
    } catch (error) {
      console.error('Error creating casual match:', error);
      throw error;
    }
  },

  /**
   * Get all casual matches
   */
  async getAllCasualMatches(limit = 100) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.CASUAL_MATCHES,
        [
          Query.orderDesc('createdAt'),
          Query.limit(limit),
        ]
      );

      return response.documents.map(doc => this.parseCasualMatch(doc));
    } catch (error) {
      console.error('Error fetching casual matches:', error);
      throw error;
    }
  },

  /**
   * Get casual matches by player
   */
  async getMatchesByPlayer(playerName, limit = 50) {
    try {
      const allMatches = await this.getAllCasualMatches(limit);
      
      return allMatches.filter(match => {
        const team1Players = [match.team1.player, match.team1.player1, match.team1.player2].filter(Boolean);
        const team2Players = [match.team2.player, match.team2.player1, match.team2.player2].filter(Boolean);
        const allPlayers = [...team1Players, ...team2Players];
        
        return allPlayers.includes(playerName);
      });
    } catch (error) {
      console.error('Error fetching player matches:', error);
      throw error;
    }
  },

  /**
   * Delete a casual match
   */
  async deleteCasualMatch(matchId) {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.CASUAL_MATCHES,
        matchId
      );
      return true;
    } catch (error) {
      console.error('Error deleting casual match:', error);
      throw error;
    }
  },

  /**
   * Parse casual match document from Appwrite
   */
  parseCasualMatch(doc) {
    return {
      id: doc.$id,
      matchType: doc.matchType,
      date: doc.date,
      team1: JSON.parse(doc.team1 || '{}'),
      team2: JSON.parse(doc.team2 || '{}'),
      score1: doc.score1,
      score2: doc.score2,
      winner: doc.winner,
      createdAt: doc.createdAt,
      appwriteId: doc.$id,
    };
  },
};