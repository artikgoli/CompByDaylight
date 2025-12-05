// leaderboard.js - Updated with simplified display and global search
const API_URL = 'https://api.neatqueue.com/api/v1/leaderboard/459532023690821643/1444664225275580518';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let leaderboardData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;

// Fetch leaderboard data from the API
async function fetchLeaderboard() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        lastUpdate.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Updating...';
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        processLeaderboardData(data);
        
        localStorage.setItem('leaderboard_cache', JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        
        const cached = localStorage.getItem('leaderboard_cache');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION * 2) {
                processLeaderboardData(data);
                if (lastUpdate) {
                    lastUpdate.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Using cached data';
                }
                return;
            }
        }
        
        if (lastUpdate) {
            lastUpdate.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to load live data';
        }
        loadMockLeaderboardData();
    }
}

// Process and display leaderboard data
function processLeaderboardData(data) {
    leaderboardData = data.alltime || [];
    filteredData = [...leaderboardData];
    
    leaderboardData.sort((a, b) => {
        const rankA = a.data?.current_rank || 999;
        const rankB = b.data?.current_rank || 999;
        return rankA - rankB;
    });
    
    filteredData.sort((a, b) => {
        const rankA = a.data?.current_rank || 999;
        const rankB = b.data?.current_rank || 999;
        return rankA - rankB;
    });
    
    updateLeaderboardTable();
    updateTopPlayers();
    updateLastUpdated();
}

// Update leaderboard table
function updateLeaderboardTable() {
    const tbody = document.getElementById('leaderboardBody');
    const paginationDiv = document.querySelector('.pagination');
    if (!tbody) return;

    // Show pagination controls when in normal mode
    if (paginationDiv) paginationDiv.style.display = 'flex';
    
    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <i class="fas fa-info-circle"></i> No players found
                </td>
            </tr>
        `;
        return;
    }
    
    pageData.forEach((player, index) => {
        const globalIndex = startIndex + index + 1;
        const row = createPlayerRow(player, globalIndex);
        tbody.appendChild(row);
    });
    
    updatePagination();
}

function createPlayerRow(player, rank) {
    const row = document.createElement('tr');
    row.dataset.playerId = player.id;

    const playerData = player.data || {};
    
    const wins = playerData.wins || 0;
    const losses = playerData.losses || 0;
    const winrate = playerData.winrate || 0;
    const winratePercent = (winrate * 100).toFixed(1) + '%';
    const mmr = playerData.mmr ? Math.round(playerData.mmr) : 0;
    const peakMMR = playerData.peak_mmr ? Math.round(playerData.peak_mmr) : mmr;
    const totalGames = playerData.totalgames || wins + losses;
    const displayRank = playerData.current_rank || rank;
    const streak = playerData.streak || 0; // Get the streak value

    let rankClass = 'rank-other';
    if (displayRank === 1) rankClass = 'rank-1';
    else if (displayRank === 2) rankClass = 'rank-2';
    else if (displayRank === 3) rankClass = 'rank-3';
    else if (displayRank <= 10) rankClass = 'rank-top10';

    // --- UPDATED LOGIC FOR STREAK DISPLAY ---
    let streakHTML = '';
    if (streak > 0) {
        // Positive streak: show fire icon with the player's color
        streakHTML = `<span class="streak-badge positive-streak" style="color: ${player.color || '#e74c3c'}">
                        <i class="fas fa-fire"></i> ${streak}
                      </span>`;
    } else if (streak < 0) {
        // Negative streak: show negative number without icon, in a distinct color
        streakHTML = `<span class="streak-badge negative-streak">
                        ${streak} <!-- This will show as -3, -5, etc. -->
                      </span>`;
    } else {
        // Streak is 0: show just "0" without icon
        streakHTML = `<span class="streak-badge zero-streak">
                        ${streak}
                      </span>`;
    }
    // --- END OF UPDATED LOGIC ---

    row.innerHTML = `
        <td>
            <span class="rank-badge ${rankClass}">#${displayRank}</span>
        </td>
        <td>
            <div class="player-cell">
                <img src="${player.avatar_url || 'images/default-avatar.png'}"
                     alt="${player.name || 'Unknown Player'}"
                     class="player-avatar"
                     onerror="this.src='images/default-avatar.png'">
                <div class="player-info">
                    <a href="profile.html?player=${player.id}" class="player-name-link">
                        ${player.name || 'Unknown Player'}
                    </a>
                </div>
            </div>
        </td>
        <td><strong>${mmr}</strong></td>
        <td class="win-loss-cell">
            <span class="wins">${wins}</span>-<span class="losses">${losses}</span>
        </td>
        <td>${winratePercent}</td>
        <td>${totalGames}</td>
        <td><strong>${peakMMR}</strong></td>
        <td>
            ${streakHTML} <!-- Use the updated streakHTML variable here -->
        </td>
    `;

    return row;
}

// Update top players section
function updateTopPlayers() {
    const topPlayersContainer = document.getElementById('topPlayers');
    if (!topPlayersContainer || filteredData.length < 3) return;
    
    topPlayersContainer.innerHTML = '';
    
    const topPlayers = filteredData.slice(0, 3);
    
    topPlayers.forEach((player, index) => {
        const playerData = player.data || {};
        const wins = playerData.wins || 0;
        const losses = playerData.losses || 0;
        const winrate = playerData.winrate || 0;
        const winratePercent = (winrate * 100).toFixed(1) + '%';
        const mmr = playerData.mmr ? Math.round(playerData.mmr) : 0;
        const peakMMR = playerData.peak_mmr ? Math.round(playerData.peak_mmr) : mmr;
        
        const card = document.createElement('div');
        card.className = `highlight-card rank-${index + 1}`;
        card.innerHTML = `
            <div class="highlight-header">
                <img src="${player.avatar_url || 'images/default-avatar.png'}" 
                     alt="${player.name}" 
                     class="highlight-avatar">
                <div class="highlight-player">
                    <h3>${player.name || 'Unknown Player'}</h3>
                    <p>Rank #${playerData.current_rank || index + 1}</p>
                </div>
            </div>
            <div class="highlight-stats">
                <div class="stat-item">
                    <span class="stat-value">${mmr}</span>
                    <span class="stat-label">MMR</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${wins}-${losses}</span>
                    <span class="stat-label">W-L</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${winratePercent}</span>
                    <span class="stat-label">Winrate</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${peakMMR}</span>
                    <span class="stat-label">Max MMR</span>
                </div>
            </div>
            <div class="highlight-favorite">
                <i class="fas fa-fire favorite-icon"></i>
                <div class="favorite-info">
                    <h4>Current Streak</h4>
                    <p>${playerData.streak || 0} games</p>
                </div>
            </div>
        `;
        
        topPlayersContainer.appendChild(card);
    });
}

// Update last updated timestamp
function updateLastUpdated() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastUpdate.innerHTML = `<i class="fas fa-check-circle"></i> Last updated: ${timeString}`;
    }
}

// Update pagination controls
function updatePagination() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!prevBtn || !nextBtn || !pageInfo) return;
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    pageInfo.textContent = totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : 'No results';
    
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            updateLeaderboardTable();
        }
    };
    
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateLeaderboardTable();
        }
    };
}

// Add this helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global search across all data - FIXED VERSION
function setupSearch() {
    const searchInput = document.getElementById('searchPlayers');
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce(function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();

        if (searchTerm === '') {
            // If search is empty, show full list with pagination
            filteredData = [...leaderboardData];
            currentPage = 1;
            updateLeaderboardTable(); // This will show page 1 of full data
        } else {
            // If user is searching, filter the data
            filteredData = leaderboardData.filter(player => {
                const name = player.name ? player.name.toLowerCase() : '';
                const ign = player.data?.ign ? player.data.ign.toLowerCase() : '';
                return name.includes(searchTerm) || ign.includes(searchTerm);
            });

            // CRITICAL FIX: Display ALL filtered results at once, ignoring pagination
            displayAllFilteredResults(filteredData);
        }

    }, 1000));
}

// NEW FUNCTION to display all search results without pagination
function displayAllFilteredResults(filteredPlayers) {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredPlayers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <i class="fas fa-info-circle"></i> No players found
                </td>
            </tr>`;
        return;
    }

    // Create rows for ALL filtered players
    filteredPlayers.forEach((player, index) => {
        // Use index + 1 for visual rank during search
        const row = createPlayerRow(player, index + 1);
        tbody.appendChild(row);
    });

    // HIDE pagination controls during active search
    const paginationDiv = document.querySelector('.pagination');
    const pageInfo = document.getElementById('pageInfo');
    if (paginationDiv) paginationDiv.style.display = 'none';
    if (pageInfo) pageInfo.textContent = `Found ${filteredPlayers.length} player(s)`;
}

// Load mock data for demo/fallback
function loadMockLeaderboardData() {
    const mockPlayers = [
        {
            id: "361506203907653633",
            name: "rocket",
            avatar_url: "https://cdn.discordapp.com/avatars/361506203907653633/8b508ad294a201287327238c9f932590.png",
            color: "#3498db",
            data: {
                mmr: 1363.9987896571542,
                peak_mmr: 1400.5,
                wins: 20,
                losses: 2,
                streak: 11,
                totalgames: 22,
                winrate: 0.9090909090909091,
                current_rank: 1
            }
        },
        {
            id: "462507304907653634",
            name: "killer_queen",
            avatar_url: "https://cdn.discordapp.com/avatars/462507304907653634/a1b2c3d4e5f6.png",
            color: "#e74c3c",
            data: {
                mmr: 1320.5,
                peak_mmr: 1350.0,
                wins: 18,
                losses: 4,
                streak: 8,
                totalgames: 22,
                winrate: 0.8181818181818182,
                current_rank: 2
            }
        },
        {
            id: "563608405907653635",
            name: "survivor_main",
            avatar_url: "https://cdn.discordapp.com/avatars/563608405907653635/g7h8i9j0k1l2.png",
            color: "#2ecc71",
            data: {
                mmr: 1285.75,
                peak_mmr: 1300.25,
                wins: 16,
                losses: 6,
                streak: 5,
                totalgames: 22,
                winrate: 0.7272727272727273,
                current_rank: 3
            }
        }
    ];
    
    for (let i = 4; i <= 25; i++) {
        const wins = 25 - i;
        const losses = i;
        const totalGames = wins + losses;
        const winrate = totalGames > 0 ? wins / totalGames : 0;
        const baseMMR = 1300 - (i * 15);
        
        mockPlayers.push({
            id: `mock_player_${i}`,
            name: `Player${i}`,
            avatar_url: `https://cdn.discordapp.com/embed/avatars/${i % 5}.png`,
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
            data: {
                mmr: baseMMR,
                peak_mmr: baseMMR + Math.random() * 50,
                wins: wins,
                losses: losses,
                streak: Math.floor(Math.random() * 10),
                totalgames: totalGames,
                winrate: winrate,
                current_rank: i
            }
        });
    }
    
    leaderboardData = mockPlayers;
    filteredData = [...mockPlayers];
    updateLeaderboardTable();
    updateTopPlayers();
    updateLastUpdated();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    fetchLeaderboard();
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchLeaderboard);
    }
    
    setupSearch();
    
    setInterval(fetchLeaderboard, CACHE_DURATION);
    
    setTimeout(() => {
        if (leaderboardData.length === 0) {
            loadMockLeaderboardData();
        }
    }, 1000);
});