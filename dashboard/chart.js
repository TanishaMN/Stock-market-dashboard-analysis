let chartInstance = null;

export function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function groupByWeek(candles) {
  const weeks = [];
  let week = null;
  candles.forEach(c => {
    const date = new Date(c.t * 1000);
    const weekNum = getWeekNumber(date);
    if (!week || week.week !== weekNum || date.getDay() === 0) {
      if (week) weeks.push(week);
      week = { week: weekNum, date: new Date(date), closes: [] };
    }
    week.closes.push(c.c);
  });
  if (week) weeks.push(week);
  return weeks.map((w, index) => ({
    label: `Week ${index + 1}`,
    dateLabel: `${w.date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`,
    close: w.closes[w.closes.length - 1]
  }));
}

function groupByMonth(candles) {
  const months = [];
  let month = null;
  candles.forEach(c => {
    const date = new Date(c.t * 1000);
    const yearMonth = `${date.getFullYear()}-${date.getMonth()}`;
    if (!month || month.yearMonth !== yearMonth) {
      if (month) months.push(month);
      month = { yearMonth, date: new Date(date), closes: [] };
    }
    month.closes.push(c.c);
  });
  if (month) months.push(month);
  return months.map(m => ({
    label: `${m.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}`,
    close: m.closes[m.closes.length - 1]
  }));
}

export function renderPriceChart(candles, type = "line", timeline = "week") {
  const ctx = document.getElementById('priceChart').getContext('2d');
  destroyChart();

  let groupedData;
  let labelText;

  switch (timeline) {
    case 'month':
      groupedData = groupByMonth(candles);
      labelText = 'Month';
      break;
    case 'week':
    default:
      groupedData = groupByWeek(candles);
      labelText = 'Week';
      break;
  }

  const labels = groupedData.map(d => d.label);
  const data = groupedData.map(d => d.close);
  const dates = groupedData.map(d => d.dateLabel || d.label);

  const fillChart = type === "area";
  const tensionValue = type === "bar" ? 0 : 0.3;

  const bodyStyle = getComputedStyle(document.body);
  const chartTextColor = bodyStyle.getPropertyValue('--text-color').trim();
  const gridColor = bodyStyle.getPropertyValue('--border-color').trim();

  chartInstance = new Chart(ctx, {
    type: (type === "area" ? "line" : type),
    data: {
      labels,
      datasets: [{
        label: 'Close Price',
        data,
        borderColor: '#1e90ff',
        backgroundColor: 'rgba(30,144,255,0.3)',
        fill: fillChart,
        tension: tensionValue,
        pointRadius: 3,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function(context) {
              return dates[context[0].dataIndex];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: labelText, color: chartTextColor },
          ticks: { maxRotation: 45, minRotation: 30, color: chartTextColor },
          grid: { color: gridColor }
        },
        y: {
          title: { display: true, text: 'Price ($)', color: chartTextColor },
          beginAtZero: false,
          ticks: { color: chartTextColor },
          grid: { color: gridColor }
        }
      },
      animation: { duration: 1200, easing: 'easeOutQuart' }
    }
  });
}

// NEW: call this whenever dark/light mode changes
export function updateChartTheme() {
  if (!chartInstance) return;
  const bodyStyle = getComputedStyle(document.body);
  const chartTextColor = bodyStyle.getPropertyValue('--text-color').trim();
  const gridColor = bodyStyle.getPropertyValue('--border-color').trim();

  chartInstance.options.scales.x.ticks.color = chartTextColor;
  chartInstance.options.scales.x.title.color = chartTextColor;
  chartInstance.options.scales.x.grid.color = gridColor;

  chartInstance.options.scales.y.ticks.color = chartTextColor;
  chartInstance.options.scales.y.title.color = chartTextColor;
  chartInstance.options.scales.y.grid.color = gridColor;

  chartInstance.update();
}
