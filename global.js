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

  // --- Data Loading & Visualization ---
  // Adjust these paths according to your repo structure.
  const dataPaths = [
    "data/sampled_2-Back.csv",
    "data/sampled_Rest.csv",
    "data/sampled_Running.csv"
  ];

  // Use Promise.all to load all CSV files
  Promise.all(dataPaths.map(path => d3.csv(path)))
    .then(files => {
      console.log("Files loaded:", files);
      // Combine the three files into one dataset.
      let combinedData = [];
      files.forEach((dataArray, fileIndex) => {
        // Optional: Log the number of rows in each file for debugging.
        console.log(`File ${dataPaths[fileIndex]} has ${dataArray.length} rows.`);
        dataArray.forEach(d => {
          // Ensure numeric values are parsed
          const timestamp = +d.timestamp;
          const heartRate = +d.heart_rate;
          const breathingRate = +d.breathing_rate;
          const activity = d.activity; // Should be "2-Back", "Rest", or "Running"
          if (isNaN(timestamp) || isNaN(heartRate) || isNaN(breathingRate)) {
            console.warn("Skipping row due to NaN value:", d);
            return;
          }
          // Create a data point for heart rate.
          combinedData.push({
            timestamp: timestamp,
            activity: activity,
            measure: "heart_rate",
            value: heartRate
          });
          // Create a data point for breathing rate.
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
      const plotContainer = document.getElementById("plot");
      if (!plotContainer) {
        console.error("Plot container (#plot) not found in HTML.");
        return;
      }
      const containerWidth = plotContainer.clientWidth || 600;
      const width = containerWidth - margin.left - margin.right;
      const height = 500 - margin.top - margin.bottom;

      // Append SVG to #plot
      const svg = d3.select("#plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // --- Scales ---
      // x-scale: using timestamp values.
      const xExtent = d3.extent(combinedData, d => d.timestamp);
      const xScale = d3.scaleLinear()
        .domain(xExtent)
        .range([0, width]);

      // y-scale: use the overall extent of values (both measures)
      const yExtent = d3.extent(combinedData, d => d.value);
      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - 5, yExtent[1] + 5])
        .range([height, 0]);

      // --- Axes ---
      svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(6).tickFormat(d => d + " s"));

      svg.append("g")
        .call(d3.axisLeft(yScale));

      // --- Color Mapping for Activities ---
      const activityColors = {
        "Running": "#e41a1c", // red
        "Rest": "#377eb8",    // blue
        "2-Back": "#4daf4a"   // green
      };

      // --- Plotting Points ---
      // heart_rate → circle, breathing_rate → square
      svg.selectAll(".point")
        .data(combinedData)
        .enter()
        .append("path")
        .attr("class", "point")
        .attr("d", d => {
          const symbolGenerator = d3.symbol().size(64);
          if (d.measure === "heart_rate") {
            symbolGenerator.type(d3.symbolCircle);
          } else {
            symbolGenerator.type(d3.symbolSquare);
          }
          return symbolGenerator();
        })
        .attr("transform", d => `translate(${xScale(d.timestamp)},${yScale(d.value)})`)
        .attr("fill", "gray")
        .attr("stroke", "none")
        .attr("opacity", 0.8);

      // --- Legend Interactions ---
      // Activity checkboxes update colors
      d3.selectAll(".activity-checkbox").on("change", updateColors);
      // Measure checkboxes toggle visibility
      d3.selectAll(".measure-checkbox").on("change", updateVisibility);

      function updateColors() {
        svg.selectAll(".point")
          .attr("fill", d => {
            const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
            return (checkbox && checkbox.checked) ? activityColors[d.activity] : "gray";
          });
      }

      function updateVisibility() {
        svg.selectAll(".point")
          .attr("display", d => {
            const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
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
