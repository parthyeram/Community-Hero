// gamification module (gamification.js)
import { addPoints } from './auth.js';

// Points configuration
const POINTS_MAP = {
    'report': 10,
    'verify': 5,
    'comment': 2
};

const ACTION_DESCRIPTIONS = {
    'report': 'Reporting a community issue',
    'verify': 'Verifying a community report',
    'comment': 'Adding community feedback'
};

// Spawn a premium gamification toast notification
export function showGamificationToast(amount, reasonText) {
    const toast = document.createElement('div');
    toast.className = 'gamification-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #10b981, #06b6d4);
        color: white;
        padding: 1.25rem 2rem;
        border-radius: var(--radius);
        box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.4);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 1rem;
        animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        font-family: 'Outfit', sans-serif;
    `;

    toast.innerHTML = `
        <div style="background: rgba(255,255,255,0.2); width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; animation: pulse 1.5s infinite;">
            +PTS
        </div>
        <div>
            <div style="font-weight: 800; font-size: 1.1rem; color: #fff;">+${amount} Hero Points!</div>
            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.9); font-weight: 400;">${reasonText}</div>
        </div>
    `;

    document.body.appendChild(toast);

    // Fade out and remove
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Award points to a user
export async function awardPoints(userId, action) {
    if (!userId) return null;
    const amount = POINTS_MAP[action] || 0;
    if (amount === 0) return null;

    const result = await addPoints(userId, amount);
    if (result) {
        showGamificationToast(amount, ACTION_DESCRIPTIONS[action]);
    }
    return result;
}

// Render badges as beautiful CSS pills
export function getBadgeHtml(badge) {
    let color = 'rgba(255,255,255,0.1)';
    let textColor = 'var(--text-muted)';
    let badgeIcon = 'Badge';

    switch (badge) {
        case 'Civic Beginner':
            color = 'rgba(99, 102, 241, 0.15)';
            textColor = '#818cf8';
            badgeIcon = 'New';
            break;
        case 'Community Hero':
            color = 'rgba(6, 182, 212, 0.15)';
            textColor = '#22d3ee';
            badgeIcon = 'Hero';
            break;
        case 'Verifier':
            color = 'rgba(249, 115, 22, 0.15)';
            textColor = '#fb923c';
            badgeIcon = 'Check';
            break;
        case 'Top Reporter':
            color = 'rgba(236, 72, 153, 0.15)';
            textColor = '#f472b6';
            badgeIcon = 'Report';
            break;
        case 'Civic Champion':
            color = 'rgba(16, 185, 129, 0.15)';
            textColor = '#34d399';
            badgeIcon = 'Top';
            break;
    }

    return `<span class="badge-pill" style="background: ${color}; color: ${textColor}; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; margin-right: 0.25rem; margin-bottom: 0.25rem; border: 1px solid rgba(255,255,255,0.05);">${badgeIcon}: ${badge}</span>`;
}

// Render the leaderboard table rows
export function renderLeaderboardRows(containerSelector, list, currentUserId) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No heroes found yet! Be the first!</td></tr>`;
        return;
    }

    list.forEach((user, index) => {
        const isSelf = user.uid === currentUserId;
        const rank = index + 1;
        
        let rankBadge = `${rank}`;
        if (rank === 1) rankBadge = '1st';
        else if (rank === 2) rankBadge = '2nd';
        else if (rank === 3) rankBadge = '3rd';

        const row = document.createElement('tr');
        row.style.cssText = `
            border-bottom: 1px solid rgba(255,255,255,0.05);
            transition: var(--transition);
            background: ${isSelf ? 'rgba(99, 102, 241, 0.05)' : 'transparent'};
        `;
        
        if (isSelf) {
            row.style.borderLeft = '3px solid var(--primary)';
        }

        const badgesHtml = (user.badges || []).map(b => getBadgeHtml(b)).join('');

        row.innerHTML = `
            <td style="padding: 1rem 0.5rem; text-align: center; font-weight: 800; font-size: 1.1rem; width: 50px;">
                ${rankBadge}
            </td>
            <td style="padding: 1rem 0.5rem; display: flex; align-items: center; gap: 0.75rem;">
                <div style="background: ${isSelf ? 'var(--primary)' : 'var(--surface-glass)'}; width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-weight: bold; text-transform: uppercase;">
                    ${user.displayName.charAt(0)}
                </div>
                <div>
                    <div style="font-weight: 600; color: ${isSelf ? 'var(--primary)' : 'white'};">${user.displayName} ${isSelf ? '(You)' : ''}</div>
                    <div style="display: flex; flex-wrap: wrap; margin-top: 0.25rem;">${badgesHtml}</div>
                </div>
            </td>
            <td style="padding: 1rem 0.5rem; text-align: right; color: var(--accent); font-weight: 800; font-size: 1.1rem;">
                ${user.points || 0} pts
            </td>
        `;
        container.appendChild(row);
    });
}
