// Recent Matches Functionality
const MATCHES_API_URL = 'https://api.neatqueue.com/api/v1/history/459532023690821643?page=1&page_size=20&limit=10&order=desc';

// Cache for match data
let latestMatchData = null;
let matchCacheTime = null;
const MATCH_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Fetch recent matches data
async function fetchRecentMatches() {
    const lastMatchUpdate = document.getElementById('lastMatchUpdate');
    if (lastMatchUpdate) {
        lastMatchUpdate.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Loading match...';
    }

    try {
        const response = await fetch(MATCHES_API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiResponse = await response.json();
        const matchesArray = apiResponse.data;

        if (!Array.isArray(matchesArray) || matchesArray.length === 0) {
            showMatchError('No recent matches found in the API response.');
            return;
        }

        // --- NEW LOGIC: Find the latest completed match by game_num ---
        // 1. Sort matches by game_num in descending order (highest number first)
        const sortedMatches = [...matchesArray].sort((a, b) => b.game_num - a.game_num);

        // 2. Loop through sorted matches to find the first valid one
        let latestValidMatch = null;
        
        for (const match of sortedMatches) {
            // Check condition 1: Match has a valid 'game' type
            if (match.game !== "player_stats") {
                console.log(`Skipping game #${match.game_num}: 'game' is not "player_stats".`);
                continue; // Skip canceled/placeholder matches
            }

            // Check condition 2: Match has REAL MMR changes (at least one player's change != 0)
            let hasRealMMRChange = false;
            
            // Check both teams for any non-zero MMR change
            if (match.teams && Array.isArray(match.teams)) {
                for (const team of match.teams) {
                    for (const player of team) {
                        if (player.mmr_change !== 0) {
                            hasRealMMRChange = true;
                            break; // Found a real change, no need to check further
                        }
                    }
                    if (hasRealMMRChange) break;
                }
            }

            if (!hasRealMMRChange) {
                console.log(`Skipping game #${match.game_num}: No player MMR change detected.`);
                continue; // Skip matches where no points were gained/lost
            }

            // If we get here, we have found a valid, completed match
            latestValidMatch = match;
            console.log(`Found valid match: Game #${match.game_num}`);
            break; // Stop looking, we found the latest valid one
        }

        // 3. Display the result
        if (latestValidMatch) {
            latestMatchData = latestValidMatch;
            matchCacheTime = Date.now();
            displayMatchData(latestValidMatch);
            updateMatchLastUpdated();
        } else {
            showMatchError('Could not find a recent completed match in the data.');
        }

    } catch (error) {
        console.error('Error fetching matches:', error);
        showMatchError('Failed to load live match data.');
    }
}

function findLatestMatch(matchesArray) {
    if (!Array.isArray(matchesArray) || matchesArray.length === 0) {
        return null;
    }

    let latestMatch = null;
    let latestTimestamp = 0;

    matchesArray.forEach(match => {
        if (match && match.time) {
            try {
                // 1. Parse the API's GMT+0 time string
                const isoTimeString = match.time.replace(' ', 'T') + 'Z'; // Add 'Z' to denote UTC
                const matchTime = new Date(isoTimeString);
                const matchTimestamp = matchTime.getTime(); // Gets time in UTC milliseconds

                if (!isNaN(matchTimestamp) && matchTimestamp > latestTimestamp) {
                    latestTimestamp = matchTimestamp;
                    latestMatch = match;
                }
            } catch (error) {
                console.warn('Could not parse time for a match:', match.time, error);
            }
        }
    });

    console.log('Latest match found:', latestMatch ? `Game #${latestMatch.game_num}` : 'None');
    return latestMatch;
}

// Updated formatLocalTime function
function formatLocalTime(apiTimeString) {
    if (!apiTimeString) return 'Time not available';

    try {
        // Create Date object from API's GMT+0 time
        const isoString = apiTimeString.replace(' ', 'T') + 'Z';
        const utcDate = new Date(isoString);

        if (isNaN(utcDate.getTime())) {
            return 'Invalid time format';
        }

        // Format in 24-hour style: "Mon, Dec 5, 14:30 UTC"
        const options = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false, // This is the key change for 24-hour format
            timeZoneName: 'short'
        };
        
        return utcDate.toLocaleString(undefined, options);

    } catch (error) {
        console.error('Error formatting time:', error);
        return apiTimeString;
    }
}

// Get player rank AND color style from leaderboard cache
function getPlayerRank(playerId) {
    try {
        const cached = localStorage.getItem('leaderboard_cache');
        if (cached) {
            const { data } = JSON.parse(cached);
            const players = data.alltime || [];
            
            // Find player in leaderboard
            const player = players.find(p => p.id === playerId);
            if (player && player.data && player.data.current_rank) {
                return {
                    rank: player.data.current_rank,
                    rankClass: getRankClass(player.data.current_rank)
                };
            }
        }
    } catch (error) {
        console.error('Error getting player rank:', error);
    }
    
    // Default if player not found
    return {
        rank: 'N/A',
        rankClass: 'rank-other'
    };
}

// Determine CSS class based on rank
function getRankClass(rank) {
    // Use the exact same class names as your leaderboard table
    if (rank === 1) return 'rank-badge rank-1';  // Match your leaderboard's class
    if (rank === 2) return 'rank-badge rank-2';
    if (rank === 3) return 'rank-badge rank-3';
    if (rank <= 10) return 'rank-badge rank-top10';
    return 'rank-badge rank-other';
}

// Display match data in the UI
function displayMatchData(match) {
    const matchContainer = document.getElementById('matchContainer');
    if (!matchContainer) return;
    
    // Get teams data
    const team1 = match.teams?.[0] || [];
    const team2 = match.teams?.[1] || [];
    const winnerIndex = match.winner;
    const team1Name = match.team_names?.[0] || 'Team 1';
    const team2Name = match.team_names?.[1] || 'Team 2';
    
    // Create HTML for the match
    matchContainer.innerHTML = `
        <div class="match-info">
            <div class="match-time">${formatLocalTime(match.time)}</div>
            <div class="match-id">Match #${match.game_num || 'Unknown'}</div>
        </div>
        
        <div class="teams-container">
            <!-- Team 1 -->
            <div class="team-card ${winnerIndex === 0 ? 'winner' : 'loser'}">
                <div class="team-header">
                    <div class="team-title">${team1Name}</div>
                    <div class="team-result ${winnerIndex === 0 ? 'win-badge' : 'loss-badge'}">
                        ${winnerIndex === 0 ? 'VICTORY' : 'DEFEAT'}
                    </div>
                </div>
                
                <div class="players-list">
                    ${team1.map(player => createPlayerMatchHTML(player, winnerIndex === 0)).join('')}
                </div>
            </div>
            
            <!-- Team 2 -->
            <div class="team-card ${winnerIndex === 1 ? 'winner' : 'loser'}">
                <div class="team-header">
                    <div class="team-title">${team2Name}</div>
                    <div class="team-result ${winnerIndex === 1 ? 'win-badge' : 'loss-badge'}">
                        ${winnerIndex === 1 ? 'VICTORY' : 'DEFEAT'}
                    </div>
                </div>
                
                <div class="players-list">
                    ${team2.map(player => createPlayerMatchHTML(player, winnerIndex === 1)).join('')}
                </div>
            </div>
        </div>
    `;
}

function getPlayerFromLeaderboard(playerId) {
    try {
        const cached = localStorage.getItem('leaderboard_cache');
        if (cached) {
            const { data } = JSON.parse(cached);
            const players = data.alltime || [];
            
            // Find player by Discord ID
            return players.find(p => p.id === playerId) || null;
        }
    } catch (error) {
        console.error('Error getting player from leaderboard:', error);
    }
    return null;
}

// Get Discord avatar URL - fallback if not in leaderboard
function getDiscordAvatarUrl(playerId, avatarHash = null) {
    // If we have an avatar hash from leaderboard, use it
    if (avatarHash) {
        return `https://cdn.discordapp.com/avatars/${playerId}/${avatarHash}.png?size=256`;
    }
    
    // Fallback: Discord embed avatar based on user ID
    const defaultAvatars = [0, 1, 2, 3, 4, 5];
    const avatarIndex = parseInt(playerId) % defaultAvatars.length;
    return `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png`;
}

// Create HTML for a player in the match WITH avatar from leaderboard
function createPlayerMatchHTML(player, isWinner) {
    const mmr = player.mmr ? Math.round(player.mmr) : 'N/A';
    const mmrChange = player.mmr_change || 0;
    
    const rankInfo = getPlayerRank(player.id);
    const rankDisplay = rankInfo.rank;
    const rankClass = rankInfo.rankClass;

    // Try to get player data from leaderboard
    const leaderboardPlayer = getPlayerFromLeaderboard(player.id);
    
    // Determine avatar URL (priority: leaderboard -> Discord embed -> default)
    let avatarUrl = 'images/default-avatar.png';
    
    if (leaderboardPlayer) {
        // Use avatar from leaderboard if available
        avatarUrl = leaderboardPlayer.avatar_url || 
                   getDiscordAvatarUrl(player.id);
    } else if (player.id) {
        // Fallback to Discord embed avatar
        avatarUrl = getDiscordAvatarUrl(player.id);
    }
    
    // Prepare player name with special characters handling
    const playerName = player.name || 'Unknown Player';
    const safePlayerName = playerName.replace(/[^\w\s\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/g, '');
    
    return `
        <div class="player-match-card">
            <div class="player-match-info">
                <img src="${avatarUrl}" 
                     alt="${safePlayerName}" 
                     class="player-match-avatar"
                     onerror="this.src='images/default-avatar.png'">
                <div class="player-match-details">
                    <h4>${playerName}</h4>
                </div>
            </div>
            
            <div class="player-rank-badge ${rankClass}">#${rankDisplay}</div>

            <div class="player-match-stats">
                <div class="stat-box">
                    <div class="stat-value">${mmr}</div>
                    <div class="stat-label">Pre-Match</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value ${mmrChange >= 0 ? 'positive' : 'negative'}">
                        ${mmrChange >= 0 ? '+' : ''}${mmrChange.toFixed(1)}
                    </div>
                    <div class="stat-label">MMR Change</div>
                </div>
            </div>
        </div>
    `;
}

// Update match last updated timestamp
function updateMatchLastUpdated() {
    const lastMatchUpdate = document.getElementById('lastMatchUpdate');
    if (lastMatchUpdate) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastMatchUpdate.innerHTML = `<i class="fas fa-check-circle"></i> Match loaded: ${timeString}`;
    }
}

// Show match error
function showMatchError(message) {
    const matchContainer = document.getElementById('matchContainer');
    if (!matchContainer) return;
    
    matchContainer.innerHTML = `
        <div class="match-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Unable to Load Match</h3>
            <p>${message}</p>
        </div>
    `;
}

// Display sample match data for demonstration
function displaySampleMatchData() {
    const sampleMatch = {
        game: "player_stats",
        time: new Date().toISOString(),
        teams: [
            [
                {
                    name: "rocket",
                    id: "361506203907653633",
                    mmr: 1363.9987896571542,
                    mmr_change: 28.27,
                    avatar_url: "https://cdn.discordapp.com/avatars/361506203907653633/8b508ad294a201287327238c9f932590.png"
                }
            ],
            [
                {
                    name: "killer_queen",
                    id: "462507304907653634",
                    mmr: 1320.5,
                    mmr_change: -39.77,
                    avatar_url: "https://cdn.discordapp.com/avatars/462507304907653634/a1b2c3d4e5f6.png"
                }
            ]
        ],
        team_names: ["rocket", "killer_queen"],
        game_num: 1128,
        winner: 0,
        mmr_change: [25, false, 1600, 25, null, null, true, true, 0, 0],
        mmr_changes: true
    };
    
    latestMatchData = sampleMatch;
    matchCacheTime = Date.now();
    displayMatchData(sampleMatch);
    updateMatchLastUpdated();
}

// Initialize matches functionality
document.addEventListener('DOMContentLoaded', function() {
    // Fetch match data when page loads
    fetchRecentMatches();
    
    // Set up refresh button
    const refreshMatchBtn = document.getElementById('refreshMatchBtn');
    if (refreshMatchBtn) {
        refreshMatchBtn.addEventListener('click', fetchRecentMatches);
    }
    
    // Auto-refresh match data every 5 minutes
    setInterval(fetchRecentMatches, 5 * 60 * 1000);
});