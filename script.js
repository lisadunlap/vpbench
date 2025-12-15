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

/**
 * Parse a simple CSV string into headers + rows.
 *
 * Notes:
 * - Assumes there are no commas inside fields (i.e., no quoted commas).
 *
 * @param {string} csvText - Raw CSV content.
 * @returns {{ headers: string[], rows: string[][] }} Parsed headers and row values.
 */
function parseSimpleCsv(csvText) {
  const lines = csvText.trim().split("\n").filter(Boolean);
  const headers = (lines[0] || "").split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((v) => v.trim()));
  return { headers, rows };
}

// ===========================
// Interactive marker comparison (DA2k data from CSV)
// ===========================

let MARKER_DATA = null;
let currentDataset = 'DA2k';

async function loadMarkerData() {
  try {
    const response = await fetch('./assets/data/marker_acc.csv');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    
    const { rows } = parseSimpleCsv(csvText);

    const parsedRows = rows.map((values) => {
      return {
        dataset: values[0],
        marker_style: values[1],
        model: values[2],
        accuracy: parseFloat(values[3]),
        rank: parseInt(values[4])
      };
    });
    
    const datasets = [...new Set(parsedRows.map((row) => row.dataset))];
    const data = {};
    
    datasets.forEach((dataset) => {
      const datasetRows = parsedRows.filter((row) => row.dataset === dataset);
      const models = [...new Set(datasetRows.map((row) => row.model))];
      const markerStyles = [...new Set(datasetRows.map((row) => row.marker_style))];
      
      data[dataset] = { models };
      
      markerStyles.forEach((style) => {
        const styleRows = datasetRows.filter((row) => row.marker_style === style);
        styleRows.sort((a, b) => models.indexOf(a.model) - models.indexOf(b.model));
        
        data[dataset][style] = {
          accuracies: styleRows.map((row) => row.accuracy),
          ranks: styleRows.map((row) => row.rank)
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

  // Set y-axis range based on dataset
  const yRange = currentDataset === 'DA2k' ? [45, 100] : [20, 100];
  
  const layout = {
    title: { text: `Accuracy Comparison (${currentDataset})`, font: { size: 14, family: "Avenir Next, Avenir, sans-serif" } },
    xaxis: { title: "", tickangle: -45, tickfont: { size: 11 } },
    yaxis: { title: "Accuracy (%)", range: yRange },
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

/**
 * Load JPEG compression rank-variance data.
 *
 * Expected CSV columns:
 * - benchmark: string (e.g., "BLINK_RD", "MME")
 * - model: string (e.g., "Llama 4 Scout")
 * - jpeg_quality: string (e.g., "default", "jpeg70", "jpeg80", "jpeg90")
 * - rank: integer (1 = best)
 *
 * @returns {Promise<Array<{benchmark: string, model: string, jpeg_quality: string, rank: number}> | null>}
 */
async function loadJpegRankData() {
  const response = await fetch("./assets/data/jpeg_rank.csv");
  if (!response.ok) {
    console.error(`Failed to load JPEG rank data: HTTP ${response.status}`);
    return null;
  }

  const csvText = await response.text();
  const { rows } = parseSimpleCsv(csvText);

  return rows
    .filter((values) => values.length >= 4)
    .map((values) => ({
      benchmark: values[0],
      model: values[1],
      jpeg_quality: values[2],
      rank: parseInt(values[3], 10),
    }));
}

/**
 * Render a two-panel Plotly chart showing rank variance across JPEG compression settings.
 *
 * Visualization:
 * - y-axis: models (ordered by default rank)
 * - x-axis: rank (lower is better)
 * - for each model: a horizontal segment from min(rank) to max(rank) across JPEG qualities,
 *   plus a dot at the "default" rank.
 *
 * @param {Array<{benchmark: string, model: string, jpeg_quality: string, rank: number}>} rows
 * @returns {void}
 */
function renderJpegRankChart(rows) {
  const container = document.getElementById("jpegRankChart");
  if (!container) return;

  const BENCHMARKS = [
    { key: "BLINK_RD", title: "BLINK Relative Depth" },
    { key: "MME", title: "MME (semantic)" },
  ];

  const byBenchmark = new Map();
  rows.forEach((r) => {
    if (!byBenchmark.has(r.benchmark)) byBenchmark.set(r.benchmark, []);
    byBenchmark.get(r.benchmark).push(r);
  });

  function qualitySortKey(q) {
    if (q === "default") return 1000;
    const m = q.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  const traces = [];
  const yCategoryArrays = {};

  BENCHMARKS.forEach((bench, benchIdx) => {
    const data = byBenchmark.get(bench.key) || [];
    if (!data.length) return;

    const byModel = new Map();
    data.forEach((r) => {
      if (!byModel.has(r.model)) byModel.set(r.model, []);
      byModel.get(r.model).push(r);
    });

    const modelsSorted = [...byModel.keys()].sort((a, b) => {
      const aDefault = (byModel.get(a) || []).find((x) => x.jpeg_quality === "default")?.rank ?? 9999;
      const bDefault = (byModel.get(b) || []).find((x) => x.jpeg_quality === "default")?.rank ?? 9999;
      return aDefault - bDefault;
    });

    yCategoryArrays[bench.key] = [...modelsSorted].reverse();

    const segmentX = [];
    const segmentY = [];
    const segmentHover = [];

    const dotX = [];
    const dotY = [];
    const dotHover = [];

    modelsSorted.forEach((model) => {
      const points = (byModel.get(model) || [])
        .slice()
        .sort((a, b) => qualitySortKey(a.jpeg_quality) - qualitySortKey(b.jpeg_quality));

      const ranks = points.map((p) => p.rank).filter((v) => Number.isFinite(v));
      if (!ranks.length) return;

      const minRank = Math.min(...ranks);
      const maxRank = Math.max(...ranks);
      const defaultRank = points.find((p) => p.jpeg_quality === "default")?.rank;

      const details = points.map((p) => `${p.jpeg_quality}: #${p.rank}`).join("<br>");

      segmentX.push(minRank, maxRank, null);
      segmentY.push(model, model, null);
      segmentHover.push(
        `<b>${model}</b><br><span>range: #${minRank}–#${maxRank}</span><br>${details}`,
        `<b>${model}</b><br><span>range: #${minRank}–#${maxRank}</span><br>${details}`,
        null
      );

      if (Number.isFinite(defaultRank)) {
        dotX.push(defaultRank);
        dotY.push(model);
        dotHover.push(`<b>${model}</b><br><span>default: #${defaultRank}</span><br>${details}`);
      }
    });

    const axisSuffix = benchIdx === 0 ? "" : "2";

    traces.push(
      {
        type: "scatter",
        mode: "lines",
        x: segmentX,
        y: segmentY,
        hoverinfo: "text",
        text: segmentHover,
        line: { color: "rgba(11, 18, 32, 0.75)", width: 2 },
        showlegend: false,
        xaxis: `x${axisSuffix}`,
        yaxis: `y${axisSuffix}`,
      },
      {
        type: "scatter",
        mode: "markers",
        x: dotX,
        y: dotY,
        hoverinfo: "text",
        text: dotHover,
        marker: { color: "rgba(11, 18, 32, 0.9)", size: 10 },
        showlegend: false,
        xaxis: `x${axisSuffix}`,
        yaxis: `y${axisSuffix}`,
      }
    );
  });

  const layout = {
    grid: { rows: 1, columns: 2, pattern: "independent" },
    margin: { l: 160, r: 30, t: 60, b: 50 },
    font: { family: "Avenir Next, Avenir, sans-serif" },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    annotations: [
      {
        text: "BLINK Relative Depth",
        x: 0.22,
        y: 1.12,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        font: { size: 20, family: "Avenir Next, Avenir, sans-serif", color: "rgba(11, 18, 32, 0.92)" },
      },
      {
        text: "MME (semantic)",
        x: 0.78,
        y: 1.12,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        font: { size: 20, family: "Avenir Next, Avenir, sans-serif", color: "rgba(11, 18, 32, 0.92)" },
      },
    ],
    xaxis: {
      title: "Rank",
      tickmode: "linear",
      tick0: 1,
      dtick: 1,
      zeroline: false,
      gridcolor: "rgba(11, 18, 32, 0.06)",
    },
    xaxis2: {
      title: "Rank",
      tickmode: "linear",
      tick0: 1,
      dtick: 1,
      zeroline: false,
      gridcolor: "rgba(11, 18, 32, 0.06)",
    },
    yaxis: {
      title: "Model",
      type: "category",
      categoryorder: "array",
      categoryarray: yCategoryArrays.BLINK_RD || [],
      automargin: true,
      gridcolor: "rgba(11, 18, 32, 0.06)",
    },
    yaxis2: {
      title: "Model",
      type: "category",
      categoryorder: "array",
      categoryarray: yCategoryArrays.MME || [],
      automargin: true,
      gridcolor: "rgba(11, 18, 32, 0.06)",
    },
  };

  const config = { responsive: true, displayModeBar: false };
  Plotly.newPlot(container, traces, layout, config);
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  const jpegRowsPromise = loadJpegRankData();
  await loadMarkerData();

  // Marker interaction (only if section exists)
  const buttons = document.querySelectorAll(".markerBtn");
  const datasetSelect = document.getElementById("datasetSelect");
  if (MARKER_DATA && buttons.length) {
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
        if (marker) updateVisualization(marker);
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
  }

  // JPEG rank plot
  const jpegRows = await jpegRowsPromise;
  if (jpegRows) renderJpegRankChart(jpegRows);
});

