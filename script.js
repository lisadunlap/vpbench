/**
 * script.js
 *
 * Expected DOM:
 * - A button with [data-copy-target="#selector"] to copy the target element's textContent.
 *
 * Outputs/side-effects:
 * - Writes BibTeX text to the clipboard when supported.
 * - Temporarily updates the button label to confirm copy success/failure.
 */

function setTempButtonLabel(button, label) {
  const original = button.textContent || "";
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function getElementText(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.textContent || "";
}

function copyTextToClipboard(text) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve(false);
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

document.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest("[data-copy-target]");
  if (!(button instanceof HTMLButtonElement)) return;

  const selector = button.getAttribute("data-copy-target");
  if (!selector) return;

  const text = getElementText(selector);
  if (text === null) {
    setTempButtonLabel(button, "Missing target");
    return;
  }

  copyTextToClipboard(text).then((ok) => {
    setTempButtonLabel(button, ok ? "Copied" : "Copy failed");
  });
});

// ===========================
// Interactive marker comparison (DA2k data from CSV)
// ===========================

let MARKER_DATA = null;
let currentDataset = 'DA2k';

async function loadMarkerData() {
  try {
    const response = await fetch('marker_acc.csv');
    const csvText = await response.text();
    
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        dataset: values[0],
        marker_style: values[1],
        model: values[2],
        accuracy: parseFloat(values[3]),
        rank: parseInt(values[4])
      };
    });
    
    const datasets = [...new Set(rows.map(row => row.dataset))];
    const data = {};
    
    datasets.forEach(dataset => {
      const datasetRows = rows.filter(row => row.dataset === dataset);
      const models = [...new Set(datasetRows.map(row => row.model))];
      const markerStyles = [...new Set(datasetRows.map(row => row.marker_style))];
      
      data[dataset] = { models };
      
      markerStyles.forEach(style => {
        const styleRows = datasetRows.filter(row => row.marker_style === style);
        styleRows.sort((a, b) => models.indexOf(a.model) - models.indexOf(b.model));
        
        data[dataset][style] = {
          accuracies: styleRows.map(row => row.accuracy),
          ranks: styleRows.map(row => row.rank)
        };
      });
    });
    
    MARKER_DATA = data;
    return data;
  } catch (error) {
    console.error('Error loading marker data:', error);
    return null;
  }
}

function updateVisualization(markerKey) {
  if (!MARKER_DATA || !MARKER_DATA[currentDataset]) {
    console.error("Data not loaded yet");
    return;
  }
  
  const datasetData = MARKER_DATA[currentDataset];
  const defaultData = datasetData.default;
  const selectedData = datasetData[markerKey] || defaultData;
  const models = datasetData.models;

  // Update Plotly bar chart
  const trace1 = {
    x: models,
    y: defaultData.accuracies,
    name: "Default",
    type: "bar",
    marker: { color: "rgba(148, 163, 184, 0.7)" }
  };
  const trace2 = {
    x: models,
    y: selectedData.accuracies,
    name: markerKey === "default" ? "Default" : markerKey.replace(/_/g, " "),
    type: "bar",
    marker: { color: "rgba(20, 184, 166, 0.7)" }
  };

  const layout = {
    title: { text: `Accuracy Comparison (${currentDataset})`, font: { size: 14, family: "Avenir Next, Avenir, sans-serif" } },
    xaxis: { title: "", tickangle: -45, tickfont: { size: 11 } },
    yaxis: { title: "Accuracy (%)", range: [20, 100] },
    barmode: "group",
    margin: { l: 50, r: 20, t: 70, b: 100 },
    font: { family: "Avenir Next, Avenir, sans-serif" },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "center",
      x: 0.5
    }
  };

  const config = { responsive: true, displayModeBar: false };
  Plotly.newPlot("accuracyChart", [trace1, trace2], layout, config);

  // Update leaderboard table
  const tbody = document.getElementById("interactiveLbBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  models.forEach((model, i) => {
    const defaultRank = defaultData.ranks[i];
    const selectedRank = selectedData.ranks[i];
    const delta = defaultRank - selectedRank; // positive = moved up

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 700;">${model}</td>
      <td class="lbCell--center"><span class="lbRank">#${selectedRank}</span></td>
      <td class="lbCell--center ${delta > 0 ? "deltaUp" : delta < 0 ? "deltaDown" : "deltaZero"}">
        ${delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} ${Math.abs(delta)}
      </td>
      <td class="lbCell--right"><span class="lbScore">${selectedData.accuracies[i].toFixed(1)}%</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadMarkerData();
  
  if (!MARKER_DATA) {
    console.error("Failed to load marker data");
    return;
  }
  
  const buttons = document.querySelectorAll(".markerBtn");
  const datasetSelect = document.getElementById("datasetSelect");
  if (!buttons.length) return;

  // Initialize with the first button's marker (color_blue)
  const firstBtn = buttons[0];
  const initialMarker = firstBtn.getAttribute("data-marker");
  updateVisualization(initialMarker || "color_blue");

  // Add click event listeners to marker buttons
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all buttons
      buttons.forEach((b) => b.classList.remove("markerBtn--active"));
      
      // Add active class to clicked button
      btn.classList.add("markerBtn--active");
      
      // Update visualization
      const marker = btn.getAttribute("data-marker");
      if (marker) {
        updateVisualization(marker);
      }
    });
  });

  // Add change event listener to dataset select
  if (datasetSelect) {
    datasetSelect.addEventListener("change", (e) => {
      currentDataset = e.target.value;
      
      // Get currently active marker button
      const activeBtn = document.querySelector(".markerBtn--active");
      const activeMarker = activeBtn ? activeBtn.getAttribute("data-marker") : "color_blue";
      
      // Update visualization with new dataset
      updateVisualization(activeMarker);
    });
  }
});

