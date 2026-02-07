import React, { useState } from 'react';
import { Trophy } from 'lucide-react';

const FinalMatchCard = ({ finalists, onSave }) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  const handleSave = () => {
    onSave(score1, score2);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 rounded-3xl shadow-2xl p-4 sm:p-8 border-4 border-yellow-400">
      <div className="text-center mb-6 sm:mb-8">
        <div className="text-5xl sm:text-7xl mb-4 animate-bounce">🏆</div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent mb-2 px-2">
          FINAL MATCH
        </h2>
        <p className="text-gray-700 font-semibold text-base sm:text-lg px-4">Top 2 teams battle for the championship!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative mb-6">
        {/* Finalist 1 */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🥇 1st Place
            </div>
            <div className="text-3xl sm:text-4xl">
              {finalists[0].emoji}
            </div>
          </div>
          <h3 className="font-bold text-xl sm:text-2xl mb-2 break-words">{finalists[0].name}</h3>
          <p className="text-sm text-gray-600 mb-4 break-words">{finalists[0].player1} & {finalists[0].player2}</p>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 sm:p-4 mb-4 border border-yellow-200">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="font-semibold text-gray-700">League Points:</span>
              <span className="font-bold text-blue-600 text-base sm:text-lg">{finalists[0].points}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="font-semibold text-gray-700">Matches Won:</span>
              <span className="font-bold text-green-600">{finalists[0].won}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="font-semibold text-gray-700">Score Difference:</span>
              <span className={`font-bold ${finalists[0].scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {finalists[0].scoreDiff > 0 ? '+' : ''}{finalists[0].scoreDiff}
              </span>
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Final Match Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score1}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore1(value);
              }
            }}
            placeholder="Enter score"
            className="w-full px-4 py-3 sm:py-4 border-3 border-yellow-400 rounded-xl focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 outline-none text-xl sm:text-2xl font-bold text-center bg-gradient-to-r from-yellow-50 to-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* VS Badge */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white w-20 h-20 rounded-full items-center justify-center font-bold text-2xl shadow-2xl z-10 animate-pulse">
          VS
        </div>
        <div className="md:hidden text-center my-2">
          <span className="bg-gradient-to-r from-yellow-500 to-red-500 text-white px-6 py-2 rounded-full text-lg font-bold shadow-lg">
            VS
          </span>
        </div>

        {/* Finalist 2 */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🥈 2nd Place
            </div>
            <div className="text-3xl sm:text-4xl">
              {finalists[1].emoji}
            </div>
          </div>
          <h3 className="font-bold text-xl sm:text-2xl mb-2 break-words">{finalists[1].name}</h3>
          <p className="text-sm text-gray-600 mb-4 break-words">{finalists[1].player1} & {finalists[1].player2}</p>
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-3 sm:p-4 mb-4 border border-gray-200">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="font-semibold text-gray-700">League Points:</span>
              <span className="font-bold text-blue-600 text-base sm:text-lg">{finalists[1].points}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span className="font-semibold text-gray-700">Matches Won:</span>
              <span className="font-bold text-green-600">{finalists[1].won}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="font-semibold text-gray-700">Score Difference:</span>
              <span className={`font-bold ${finalists[1].scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {finalists[1].scoreDiff > 0 ? '+' : ''}{finalists[1].scoreDiff}
              </span>
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Final Match Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score2}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore2(value);
              }
            }}
            placeholder="Enter score"
            className="w-full px-4 py-4 border-3 border-gray-400 rounded-xl focus:border-gray-500 focus:ring-4 focus:ring-gray-200 outline-none text-2xl font-bold text-center bg-gradient-to-r from-gray-50 to-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!score1 || !score2 || score1 === score2}
        className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        <Trophy size={24} />
        Declare Champion!
      </button>
      {score1 === score2 && score1 !== '' && (
        <p className="text-center text-red-600 text-sm mt-2 font-semibold">
          Scores must be different to declare a winner
        </p>
      )}
    </div>
  );
};

export default FinalMatchCard;