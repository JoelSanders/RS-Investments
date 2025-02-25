// RS Investments - Main Application Script

// Global variables
let portfolioData = [];
let stockPrices = {};
let charts = {};

// DOM Elements
const excelFileInput = document.getElementById('excel-file');
const refreshDataBtn = document.getElementById('refresh-data');
const themeToggleBtn = document.getElementById('theme-toggle');
const loadingOverlay = document.getElementById('loading-overlay');
const stockTableBody = document.getElementById('stock-table-body');
const searchStocksInput = document.getElementById('search-stocks');
const sortBySelect = document.getElementById('sort-by');

// Summary elements
const totalValueEl = document.getElementById('total-value');
const totalChangeEl = document.getElementById('total-change');
const todayChangeEl = document.getElementById('today-change');
const todayPercentEl = document.getElementById('today-percent');
const totalGainLossEl = document.getElementById('total-gain-loss');
const totalGainLossPercentEl = document.getElementById('total-gain-loss-percent');
const holdingsCountEl = document.getElementById('holdings-count');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initTheme();
    initCharts();
});

// Initialize event listeners
function initEventListeners() {
    // Excel file upload
    excelFileInput.addEventListener('change', handleExcelUpload);
    
    // Refresh data button
    refreshDataBtn.addEventListener('click', () => {
        if (portfolioData.length > 0) {
            fetchStockData(portfolioData.map(item => item.symbol));
        } else {
            showNotification('Please upload a portfolio first', 'warning');
        }
    });
    
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search functionality
    searchStocksInput.addEventListener('input', filterStockTable);
    
    // Sort functionality
    sortBySelect.addEventListener('change', sortStockTable);
}

// Initialize theme based on user preference
function initTheme() {
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkMode)) {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// Toggle between light and dark theme
function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    themeToggleBtn.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Update chart themes
    updateChartThemes();
}

// Initialize charts with empty data
function initCharts() {
    const allocationCtx = document.getElementById('allocation-chart').getContext('2d');
    const performanceCtx = document.getElementById('performance-chart').getContext('2d');
    
    // Get theme colors
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
    
    // Allocation chart (pie chart)
    charts.allocation = new Chart(allocationCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.formattedValue;
                            const percentage = context.parsed;
                            return `${label}: $${value} (${percentage.toFixed(1)}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Performance chart (line chart)
    charts.performance = new Chart(performanceCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Portfolio Value',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        },
                        color: textColor
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Update chart themes based on current theme
function updateChartThemes() {
    const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
    
    // Update allocation chart
    if (charts.allocation) {
        charts.allocation.options.plugins.legend.labels.color = textColor;
        charts.allocation.update();
    }
    
    // Update performance chart
    if (charts.performance) {
        charts.performance.options.scales.x.ticks.color = textColor;
        charts.performance.options.scales.y.ticks.color = textColor;
        charts.performance.update();
    }
}

// Handle Excel file upload
async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        showLoading('Parsing Excel file...');
        
        const data = await readExcelFile(file);
        if (!data || data.length === 0) {
            throw new Error('No data found in the Excel file');
        }
        
        // Process the data
        portfolioData = processExcelData(data);
        
        // Fetch stock data for the portfolio
        await fetchStockData(portfolioData.map(item => item.symbol));
        
        // Reset file input
        excelFileInput.value = '';
        
    } catch (error) {
        console.error('Error processing Excel file:', error);
        showNotification('Error processing Excel file: ' + error.message, 'error');
        hideLoading();
    }
}

// Read Excel file and return data
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = function(error) {
            reject(error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Process Excel data into a standardized format
function processExcelData(data) {
    // Expected columns in Excel: Symbol, Company Name, Shares, Average Cost
    // If column names are different, adjust the mapping here
    return data.map(row => {
        // Try to find the correct column names (case insensitive)
        const symbolKey = findKey(row, ['symbol', 'ticker', 'stock symbol', 'stock']);
        const nameKey = findKey(row, ['company name', 'name', 'company', 'description']);
        const sharesKey = findKey(row, ['shares', 'quantity', 'qty', 'share count', 'position']);
        const costKey = findKey(row, ['average cost', 'avg cost', 'cost basis', 'price paid', 'purchase price']);
        
        if (!symbolKey) {
            throw new Error('Could not find a column for stock symbol in the Excel file');
        }
        
        return {
            symbol: String(row[symbolKey]).toUpperCase().trim(),
            name: nameKey ? String(row[nameKey]) : '',
            shares: sharesKey ? parseFloat(row[sharesKey]) : 0,
            avgCost: costKey ? parseFloat(row[costKey]) : 0,
            currentPrice: 0,
            previousClose: 0,
            change: 0,
            changePercent: 0,
            totalValue: 0,
            gainLoss: 0,
            gainLossPercent: 0
        };
    }).filter(item => item.symbol && item.shares > 0);
}

// Helper function to find a key in an object that matches any of the provided options (case insensitive)
function findKey(obj, options) {
    const keys = Object.keys(obj);
    for (const option of options) {
        const matchingKey = keys.find(key => key.toLowerCase() === option.toLowerCase());
        if (matchingKey) return matchingKey;
    }
    return null;
}

// Fetch real-time stock data for the given symbols
async function fetchStockData(symbols) {
    if (!symbols || symbols.length === 0) return;
    
    showLoading('Fetching real-time stock data...');
    
    try {
        // Using Alpha Vantage API for stock data
        // Note: In a real application, you would need to sign up for an API key
        // and implement proper rate limiting
        const apiKey = 'demo'; // Replace with your actual API key
        
        // Due to API limitations, we'll fetch data for each symbol individually
        // In a production environment, consider using batch requests if available
        const promises = symbols.map(symbol => 
            fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`)
                .then(response => response.json())
        );
        
        const results = await Promise.all(promises);
        
        // Process the results
        results.forEach((result, index) => {
            const symbol = symbols[index];
            
            // Check if we got valid data
            if (result['Global Quote']) {
                const quote = result['Global Quote'];
                stockPrices[symbol] = {
                    price: parseFloat(quote['05. price']),
                    previousClose: parseFloat(quote['08. previous close']),
                    change: parseFloat(quote['09. change']),
                    changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
                };
            } else {
                console.warn(`No data returned for ${symbol}`);
                // Use mock data for demo purposes
                stockPrices[symbol] = getMockStockData(symbol);
            }
        });
        
        // Update portfolio data with stock prices
        updatePortfolioData();
        
        // Update UI
        updateUI();
        
    } catch (error) {
        console.error('Error fetching stock data:', error);
        showNotification('Error fetching stock data. Using mock data instead.', 'warning');
        
        // Use mock data as fallback
        symbols.forEach(symbol => {
            stockPrices[symbol] = getMockStockData(symbol);
        });
        
        // Update portfolio with mock data
        updatePortfolioData();
        updateUI();
    } finally {
        hideLoading();
    }
}

// Generate mock stock data for demo purposes
function getMockStockData(symbol) {
    // Find the stock in our portfolio
    const stock = portfolioData.find(item => item.symbol === symbol);
    const avgCost = stock ? stock.avgCost : 100;
    
    // Generate a random price around the average cost
    const randomFactor = 0.8 + Math.random() * 0.4; // Between 0.8 and 1.2
    const price = avgCost * randomFactor;
    
    // Generate a random previous close
    const previousCloseFactor = 0.98 + Math.random() * 0.04; // Between 0.98 and 1.02
    const previousClose = price * previousCloseFactor;
    
    const change = price - previousClose;
    const changePercent = (change / previousClose) * 100;
    
    return {
        price,
        previousClose,
        change,
        changePercent
    };
}

// Update portfolio data with current stock prices
function updatePortfolioData() {
    portfolioData.forEach(item => {
        const stockData = stockPrices[item.symbol];
        if (stockData) {
            item.currentPrice = stockData.price;
            item.previousClose = stockData.previousClose;
            item.change = stockData.change;
            item.changePercent = stockData.changePercent;
            item.totalValue = item.shares * item.currentPrice;
            item.gainLoss = item.totalValue - (item.shares * item.avgCost);
            item.gainLossPercent = (item.gainLoss / (item.shares * item.avgCost)) * 100;
        }
    });
}

// Update the UI with the latest portfolio data
function updateUI() {
    updateSummary();
    updateStockTable();
    updateCharts();
}

// Update the summary section
function updateSummary() {
    // Calculate totals
    const totalValue = portfolioData.reduce((sum, item) => sum + item.totalValue, 0);
    const totalCost = portfolioData.reduce((sum, item) => sum + (item.shares * item.avgCost), 0);
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = (totalGainLoss / totalCost) * 100;
    
    // Calculate today's change
    const todayChange = portfolioData.reduce((sum, item) => sum + (item.change * item.shares), 0);
    const todayChangePercent = (todayChange / (totalValue - todayChange)) * 100;
    
    // Update the UI
    totalValueEl.textContent = formatCurrency(totalValue);
    totalChangeEl.textContent = formatPercentage(totalGainLossPercent);
    totalChangeEl.className = `change ${totalGainLossPercent >= 0 ? 'positive' : 'negative'}`;
    
    todayChangeEl.textContent = formatCurrency(todayChange);
    todayPercentEl.textContent = formatPercentage(todayChangePercent);
    todayPercentEl.className = `change ${todayChangePercent >= 0 ? 'positive' : 'negative'}`;
    
    totalGainLossEl.textContent = formatCurrency(totalGainLoss);
    totalGainLossPercentEl.textContent = formatPercentage(totalGainLossPercent);
    totalGainLossPercentEl.className = `change ${totalGainLossPercent >= 0 ? 'positive' : 'negative'}`;
    
    holdingsCountEl.textContent = portfolioData.length;
}

// Update the stock table
function updateStockTable() {
    // Clear the table
    stockTableBody.innerHTML = '';
    
    if (portfolioData.length === 0) {
        // Show empty state
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-state';
        emptyRow.innerHTML = `
            <td colspan="8">
                <div class="empty-message">
                    <i class="fas fa-file-upload"></i>
                    <p>Import an Excel file to view your portfolio</p>
                </div>
            </td>
        `;
        stockTableBody.appendChild(emptyRow);
        return;
    }
    
    // Sort the data if needed
    const sortedData = [...portfolioData];
    sortStockData(sortedData);
    
    // Filter the data if search is active
    const filteredData = filterStockData(sortedData);
    
    // Add rows to the table
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${item.symbol}</td>
            <td>${item.name || item.symbol}</td>
            <td>${item.shares.toLocaleString()}</td>
            <td>${formatCurrency(item.avgCost)}</td>
            <td>${formatCurrency(item.currentPrice)}</td>
            <td class="${item.changePercent >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(item.change)} (${formatPercentage(item.changePercent)})
            </td>
            <td>${formatCurrency(item.totalValue)}</td>
            <td class="${item.gainLossPercent >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(item.gainLoss)} (${formatPercentage(item.gainLossPercent)})
            </td>
        `;
        
        stockTableBody.appendChild(row);
    });
}

// Update the charts with the latest data
function updateCharts() {
    // Update allocation chart
    updateAllocationChart();
    
    // Update performance chart (mock data for demo)
    updatePerformanceChart();
}

// Update the allocation chart
function updateAllocationChart() {
    // Sort data by value for better visualization
    const sortedData = [...portfolioData].sort((a, b) => b.totalValue - a.totalValue);
    
    // Prepare data for the chart
    const labels = sortedData.map(item => item.symbol);
    const values = sortedData.map(item => item.totalValue);
    
    // Generate colors
    const colors = generateChartColors(sortedData.length);
    
    // Update the chart
    charts.allocation.data.labels = labels;
    charts.allocation.data.datasets[0].data = values;
    charts.allocation.data.datasets[0].backgroundColor = colors;
    charts.allocation.update();
}

// Update the performance chart with mock historical data
function updatePerformanceChart() {
    // Generate mock historical data for demo purposes
    const totalValue = portfolioData.reduce((sum, item) => sum + item.totalValue, 0);
    const dates = [];
    const values = [];
    
    // Generate data for the last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Generate a random value around the current total value
        const randomFactor = 0.9 + (i / 30) * 0.2 + Math.random() * 0.05;
        values.push(totalValue * randomFactor);
    }
    
    // Update the chart
    charts.performance.data.labels = dates;
    charts.performance.data.datasets[0].data = values;
    charts.performance.update();
}

// Generate colors for the chart
function generateChartColors(count) {
    const colors = [];
    const hueStep = 360 / count;
    
    for (let i = 0; i < count; i++) {
        const hue = i * hueStep;
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    
    return colors;
}

// Filter the stock table based on search input
function filterStockTable() {
    updateStockTable();
}

// Filter stock data based on search input
function filterStockData(data) {
    const searchTerm = searchStocksInput.value.toLowerCase().trim();
    if (!searchTerm) return data;
    
    return data.filter(item => 
        item.symbol.toLowerCase().includes(searchTerm) || 
        (item.name && item.name.toLowerCase().includes(searchTerm))
    );
}

// Sort the stock table based on selected option
function sortStockTable() {
    updateStockTable();
}

// Sort stock data based on selected option
function sortStockData(data) {
    const sortBy = sortBySelect.value;
    
    switch (sortBy) {
        case 'symbol':
            data.sort((a, b) => a.symbol.localeCompare(b.symbol));
            break;
        case 'name':
            data.sort((a, b) => {
                const nameA = a.name || a.symbol;
                const nameB = b.name || b.symbol;
                return nameA.localeCompare(nameB);
            });
            break;
        case 'price':
            data.sort((a, b) => b.currentPrice - a.currentPrice);
            break;
        case 'change':
            data.sort((a, b) => b.changePercent - a.changePercent);
            break;
        case 'value':
            data.sort((a, b) => b.totalValue - a.totalValue);
            break;
        default:
            // Default sort by value
            data.sort((a, b) => b.totalValue - a.totalValue);
    }
    
    return data;
}

// Format a number as currency
function formatCurrency(value) {
    return '$' + value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format a number as percentage
function formatPercentage(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}%`;
}

// Show loading overlay
function showLoading(message = 'Loading...') {
    loadingOverlay.querySelector('p').textContent = message;
    loadingOverlay.classList.remove('hidden');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Show notification (for demo purposes, we'll use alert)
function showNotification(message, type = 'info') {
    // In a real application, you would use a proper notification system
    alert(`${type.toUpperCase()}: ${message}`);
} 