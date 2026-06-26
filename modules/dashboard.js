// dashboard module (dashboard.js)

let categoryChartInstance = null;
let monthlyChartInstance = null;
let statusChartInstance = null;

// Helpers to extract and group database issues
function getCategoryData(issues) {
    const categories = ['Pothole', 'Water Leakage', 'Streetlight Damage', 'Waste Management', 'Road Damage', 'Public Safety', 'Infrastructure Damage', 'Other'];
    const counts = {};
    categories.forEach(cat => counts[cat] = 0);
    
    issues.forEach(issue => {
        if (counts[issue.category] !== undefined) {
            counts[issue.category]++;
        } else {
            counts['Other']++;
        }
    });

    return {
        labels: Object.keys(counts),
        values: Object.values(counts)
    };
}

function getMonthlyData(issues) {
    // Generate last 6 months labels
    const months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = {};

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
        months.push(label);
        counts[label] = 0;
    }

    issues.forEach(issue => {
        const date = new Date(issue.createdAt);
        const label = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().substr(-2)}`;
        if (counts[label] !== undefined) {
            counts[label]++;
        }
    });

    return {
        labels: months,
        values: months.map(m => counts[m])
    };
}

function getStatusData(issues) {
    const statuses = ['Open', 'Verified', 'In Progress', 'Resolved'];
    const counts = {};
    statuses.forEach(status => counts[status] = 0);

    issues.forEach(issue => {
        if (counts[issue.status] !== undefined) {
            counts[issue.status]++;
        } else {
            counts['Open']++;
        }
    });

    return {
        labels: Object.keys(counts),
        values: Object.values(counts)
    };
}

// Compute aggregate metrics
export function computeStats(issues) {
    const total = issues.length;
    let open = 0;
    let resolved = 0;
    let inProgress = 0;
    let verified = 0;
    
    let totalResolutionTime = 0;
    let resolvedCountWithTime = 0;

    issues.forEach(i => {
        if (i.status === 'Open') open++;
        else if (i.status === 'Verified') verified++;
        else if (i.status === 'In Progress') inProgress++;
        else if (i.status === 'Resolved') resolved++;

        if (i.status === 'Resolved' && i.resolvedAt && i.createdAt) {
            const timeDiff = new Date(i.resolvedAt) - new Date(i.createdAt);
            totalResolutionTime += timeDiff;
            resolvedCountWithTime++;
        }
    });

    // Average resolution time in hours
    const avgResolutionTime = resolvedCountWithTime > 0 
        ? Math.round(totalResolutionTime / (resolvedCountWithTime * 60 * 60 * 1000))
        : 24; // Default fallback to 24h

    return {
        total,
        open: open + verified + inProgress,
        resolved,
        avgResolutionTime: `${avgResolutionTime}h`
    };
}

export function renderCharts(canvasElements, issues) {
    const { categoryCanvas, monthlyCanvas, statusCanvas } = canvasElements;

    // Destory existing chart instances to avoid redraw glitches
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    if (statusChartInstance) statusChartInstance.destroy();

    const categoryData = getCategoryData(issues);
    const monthlyData = getMonthlyData(issues);
    const statusData = getStatusData(issues);

    const themeColors = {
        primary: '#6366f1',
        secondary: '#ec4899',
        accent: '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        gridLine: 'rgba(255, 255, 255, 0.05)',
        text: '#94a3b8'
    };

    // 1. Category Donut Chart
    categoryChartInstance = new Chart(categoryCanvas, {
        type: 'doughnut',
        data: {
            labels: categoryData.labels,
            datasets: [{
                data: categoryData.values,
                backgroundColor: [
                    themeColors.danger,
                    themeColors.accent,
                    themeColors.warning,
                    themeColors.success,
                    '#a855f7', // Purple
                    '#f43f5e', // Rose
                    '#e11d48', // Red-dark
                    '#4b5563'  // Gray
                ],
                borderWidth: 1,
                borderColor: '#1e293b'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: themeColors.text, font: { family: 'Outfit', size: 11 } }
                }
            }
        }
    });

    // 2. Monthly Trend Line Chart
    monthlyChartInstance = new Chart(monthlyCanvas, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Issues Reported',
                data: monthlyData.values,
                borderColor: themeColors.primary,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointBackgroundColor: themeColors.secondary,
                pointBorderColor: '#fff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: themeColors.gridLine },
                    ticks: { color: themeColors.text, font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: themeColors.gridLine },
                    ticks: { color: themeColors.text, precision: 0, font: { family: 'Outfit' } }
                }
            }
        }
    });

    // 3. Status Bar Chart
    statusChartInstance = new Chart(statusCanvas, {
        type: 'bar',
        data: {
            labels: statusData.labels,
            datasets: [{
                label: 'Issues Count',
                data: statusData.values,
                backgroundColor: [
                    themeColors.danger,   // Open
                    '#f97316',            // Verified (Orange)
                    themeColors.warning,  // In Progress
                    themeColors.success   // Resolved
                ],
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: themeColors.text, font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: themeColors.gridLine },
                    ticks: { color: themeColors.text, precision: 0, font: { family: 'Outfit' } }
                }
            }
        }
    });

    console.log("Dashboard Chart.js graphs loaded.");
}
