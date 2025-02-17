document.addEventListener("DOMContentLoaded", () => {
  // --- Light/Dark Mode Toggle ---
  const toggleButton = document.getElementById("toggle-theme");
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  } else {
    console.warn("Toggle theme button not found in DOM.");
  }

  // --- Tooltip Setup ---
  const plotContainer = document.getElementById("plot");
  let tooltip;
  if (plotContainer) {
    tooltip = document.createElement("div");
    tooltip.classList.add("tooltip");
    plotContainer.appendChild(tooltip);
  }

  // --- Data Loading & Visualization ---
  // Adjust these paths according to your repo structure.
  const dataPaths = [
    "data/sampled_2-Back.csv",
    "data/sampled_Rest.csv",
    "data/sampled_Running.csv"
  ];

  Promise.all(dataPaths.map(path => d3.csv(path)))
    .then(files => {
      // Combine the files into one dataset.
      let combinedData = [];
      files.forEach((dataArray) => {
        dataArray.forEach(d => {
          // Parse numeric values
          const timestamp = +d.timestamp;
          const heartRate = +d.heart_rate;
          const breathingRate = +d.breathing_rate;
          const activity = d.activity; // e.g. "2-Back", "Rest", "Running"

          if (isNaN(timestamp) || isNaN(heartRate) || isNaN(breathingRate)) {
            console.warn("Skipping row due to NaN value:", d);
            return;
          }
          // One row for heart_rate
          combinedData.push({
            timestamp: timestamp,
            activity: activity,
            measure: "heart_rate",
            value: heartRate
          });
          // One row for breathing_rate
          combinedData.push({
            timestamp: timestamp,
            activity: activity,
            measure: "breathing_rate",
            value: breathingRate
          });
        });
      });
      console.log("Combined data points:", combinedData.length);

      // --- Set up SVG dimensions ---
      const margin = { top: 20, right: 20, bottom: 40, left: 60 };
      const containerWidth = plotContainer.clientWidth || 600;
      const width = containerWidth - margin.left - margin.right;
      const height = 500 - margin.top - margin.bottom;

      const svg = d3.select("#plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      const chartArea = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // --- Scales ---
      const xExtent = d3.extent(combinedData, d => d.timestamp);
      const xScale = d3.scaleLinear()
        .domain(xExtent)
        .range([0, width])
        .nice();

      const yExtent = d3.extent(combinedData, d => d.value);
      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - 5, yExtent[1] + 5])
        .range([height, 0])
        .nice();

      // --- Axes ---
      const xAxis = d3.axisBottom(xScale)
        .ticks(6)
        .tickFormat(d => d + " s");

      const yAxis = d3.axisLeft(yScale);

      chartArea.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

      chartArea.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

      // --- Zoom & Pan Setup ---
      const zoomBehavior = d3.zoom()
        .scaleExtent([1, 20]) // how far you can zoom in or out
        .translateExtent([[0, 0], [width, height]]) // limit panning
        .extent([[0, 0], [width, height]])
        .on("zoom", (event) => {
          const transform = event.transform;
          const newXScale = transform.rescaleX(xScale);
          const newYScale = transform.rescaleY(yScale);

          // Update points
          points.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });

          // Update axes
          chartArea.select(".x-axis")
            .call(xAxis.scale(newXScale));
          chartArea.select(".y-axis")
            .call(yAxis.scale(newYScale));
        });

      svg.call(zoomBehavior);

      // Double-click to reset zoom
      svg.on("dblclick", () => {
        svg.transition()
          .duration(750)
          .call(zoomBehavior.transform, d3.zoomIdentity);
      });

      // --- Color Mapping for Activities ---
      const activityColors = {
        "Running": "#e41a1c",
        "Rest": "#377eb8",
        "2-Back": "#4daf4a"
      };

      // --- Plot Points ---
      const symbolGenerator = d3.symbol().size(64);

      const points = chartArea.selectAll(".point")
        .data(combinedData)
        .enter()
        .append("path")
        .attr("class", "point")
        .attr("d", d => {
          // heart_rate → circle; breathing_rate → square
          if (d.measure === "heart_rate") {
            symbolGenerator.type(d3.symbolCircle);
          } else {
            symbolGenerator.type(d3.symbolSquare);
          }
          return symbolGenerator();
        })
        .attr("transform", d => {
          const tx = xScale(d.timestamp);
          const ty = yScale(d.value);
          return `translate(${tx},${ty})`;
        })
        .attr("fill", "gray")
        .attr("stroke", "none")
        .attr("opacity", 0.8)
        // Highlight & tooltip on hover
        .on("mouseover", function(event, d) {
          // Highlight
          d3.select(this).classed("highlight", true);

          // Show tooltip
          if (!tooltip) return;
          tooltip.style.opacity = 1;
          tooltip.innerHTML = `
            <strong>Activity:</strong> ${d.activity}<br/>
            <strong>Measure:</strong> ${d.measure}<br/>
            <strong>Value:</strong> ${d.value.toFixed(1)}<br/>
            <strong>Time:</strong> ${d.timestamp.toFixed(1)}s
          `;
        })
        .on("mousemove", function(event, d) {
          if (!tooltip) return;
          // Position tooltip near the hovered point
          // Convert data coords -> screen coords
          const [mx, my] = d3.pointer(event, plotContainer);
          tooltip.style.left = (mx + 15) + "px";    // offset by 15px
          tooltip.style.top = (my - 10) + "px";     // slight upward shift
        })
        .on("mouseout", function() {
          // Un-highlight
          d3.select(this).classed("highlight", false);

          // Hide tooltip
          if (tooltip) {
            tooltip.style.opacity = 0;
          }
        });

      // --- Legend Interactions ---
      // Activity checkboxes update colors
      d3.selectAll(".activity-checkbox").on("change", updateColors);
      // Measure checkboxes toggle visibility
      d3.selectAll(".measure-checkbox").on("change", updateVisibility);

      function updateColors() {
        chartArea.selectAll(".point")
          .attr("fill", d => {
            const checkbox = document.querySelector(`.activity-checkbox[value=\"${d.activity}\"]`);
            return (checkbox && checkbox.checked) ? activityColors[d.activity] : "gray";
          });
      }

      function updateVisibility() {
        chartArea.selectAll(".point")
          .attr("display", d => {
            const checkbox = document.querySelector(`.measure-checkbox[value=\"${d.measure}\"]`);
            return (checkbox && checkbox.checked) ? null : "none";
          });
      }

      // Initialize the colors and visibility.
      updateColors();
      updateVisibility();
    })
    .catch(error => {
      console.error("Error loading data:", error);
    });
});
