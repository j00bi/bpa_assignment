class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.currentYear = new Date().getFullYear();
        this.initElements();
        this.initEventListeners();
        this.render();
        this.loadSheetJS();
    }

    loadSheetJS() {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => console.log('SheetJS loaded');
        document.head.appendChild(script);
    }

    initElements() {
        this.form = document.getElementById('expenseForm');
        this.titleInput = document.getElementById('title');
        this.amountInput = document.getElementById('amount');
        this.dateInput = document.getElementById('date');
        this.yearFilter = document.getElementById('yearFilter');
        this.expenseList = document.getElementById('expenseList');
        this.noExpenses = document.getElementById('noExpenses');
        this.chartCtx = document.getElementById('expenseChart').getContext('2d');
        this.chart = null;
    }

    initEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.yearFilter.addEventListener('change', () => this.render());
        document.getElementById('viewMode').addEventListener('change', () => this.render());
        document.getElementById('importBtn').addEventListener('click', () => this.handleImport());
        document.getElementById('removeAllBtn').addEventListener('click', () => this.removeAllExpenses());
        
        // Delegated event listener for delete buttons
        this.expenseList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const expenseId = e.target.closest('.expense-item').dataset.id;
                this.deleteExpense(expenseId);
            }
        });
    }

    deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveToLocalStorage();
            this.render();
        }
    }

    removeAllExpenses() {
        if (confirm('Are you sure you want to delete ALL expenses? This cannot be undone.')) {
            this.expenses = [];
            this.saveToLocalStorage();
            this.render();
        }
    }

    handleImport() {
        const fileInput = document.getElementById('excelFile');
        if (!fileInput.files.length) return;

        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            jsonData.forEach(row => {
                if (row.Title && row.Amount && row.Date) {
                    this.expenses.push({
                        id: Date.now().toString(),
                        title: row.Title.toString(),
                        amount: parseFloat(row.Amount),
                        date: new Date(row.Date).toISOString().split('T')[0],
                        category: row.Category ? row.Category.toString() : 'Others',
                        createdAt: new Date().toISOString()
                    });
                }
            });

            this.saveToLocalStorage();
            this.render();
            fileInput.value = ''; // Clear file input
        };

        reader.readAsArrayBuffer(file);
    }

    handleSubmit(e) {
        e.preventDefault();
        
            const expense = {
                id: Date.now().toString(),
                title: this.titleInput.value.trim(),
                amount: parseFloat(this.amountInput.value),
                date: this.dateInput.value,
                category: document.getElementById('category').value,
                createdAt: new Date().toISOString()
            };

        this.expenses.push(expense);
        this.saveToLocalStorage();
        this.form.reset();
        this.render();
    }

    saveToLocalStorage() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    getFilteredExpenses() {
        const selectedYear = parseInt(this.yearFilter.value);
        return this.expenses.filter(expense => {
            return new Date(expense.date).getFullYear() === selectedYear;
        });
    }

    renderExpenseList(expenses) {
        if (expenses.length === 0) {
            this.expenseList.style.display = 'none';
            this.noExpenses.style.display = 'block';
            return;
        }

        this.expenseList.style.display = 'block';
        this.noExpenses.style.display = 'none';

        this.expenseList.innerHTML = expenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(expense => `
                <div class="expense-item" data-id="${expense.id}">
                    <div>
                        <strong>${expense.title}</strong>
                        <div class="text-muted small">
                            ${new Date(expense.date).toLocaleDateString()} • ${expense.category}
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="expense-amount me-3">RM ${expense.amount.toFixed(2)}</div>
                        <button class="btn btn-sm btn-outline-danger delete-btn">×</button>
                    </div>
                </div>
            `).join('');
    }

    renderChart(expenses) {
        if (this.chart) {
            this.chart.destroy();
        }

        // Group by category
        const categories = {};
        expenses.forEach(expense => {
            if (!categories[expense.category]) {
                categories[expense.category] = 0;
            }
            categories[expense.category] += expense.amount;
        });

        // Group by month
        const monthlyTotals = Array(12).fill(0);
        expenses.forEach(expense => {
            const month = new Date(expense.date).getMonth();
            monthlyTotals[month] += expense.amount;
        });

        // Create chart based on view mode
        const viewMode = document.getElementById('viewMode')?.value || 'month';
        
        if (viewMode === 'category') {
                this.chart = new Chart(this.chartCtx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(categories),
                        datasets: [{
                            data: Object.values(categories),
                            backgroundColor: [
                                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                                '#FF9F40', '#8AC24A', '#607D8B', '#E91E63', '#9C27B0'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Expenses by Category (RM)'
                            }
                        },
                        tooltips: {
                            callbacks: {
                                label: function(tooltipItem, data) {
                                    const label = data.labels[tooltipItem.index];
                                    const value = data.datasets[0].data[tooltipItem.index];
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: RM${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                });
        } else {
            this.chart = new Chart(this.chartCtx, {
                type: 'bar',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Monthly Expenses (RM)',
                        data: monthlyTotals,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    render() {
        const filteredExpenses = this.getFilteredExpenses();
        this.renderExpenseList(filteredExpenses);
        this.renderChart(filteredExpenses);
        this.updateTotalBar(filteredExpenses);
    }

    updateTotalBar(expenses) {
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalAmount').textContent = 
            total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        document.getElementById('totalYear').textContent = this.yearFilter.value;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ExpenseTracker();
});
