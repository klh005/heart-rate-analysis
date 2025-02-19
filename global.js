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
    tooltip.style.opacity = 0; // Hide initially.
    plotContainer.appendChild(tooltip);
  }

  // --- Heart Button Setup ---
  const heartButton = document.getElementById("heart-button");
  if (heartButton) {
    console.log("Heart button found:", heartButton);
    // Ensure the heart button is visible when needed.
    heartButton.style.display = "block";
  } else {
    console.warn("Heart button not found in DOM. Please ensure your HTML includes <button id='heart-button'>❤</button>");
  }

  // --- Legend Container ---
  const legendContainer = document.getElementById("legend");
  if (legendContainer) {
    // Initially hide legend until final interactive mode.
    legendContainer.style.display = "none";
  }

  // --- Narrative Container ---
  const narrativeContainer = document.getElementById("narrative");

  // Define narrative text for each step.
  const stepsText = {
    "1": "Step 1: The chart starts off with all data points in gray.",
    "2": "Step 2: Now the points separate by measure: heart rate turns red and respiratory rate turns blue.",
    "3": "Step 3: The respiratory (blue) points are hidden, leaving only heart rate visible.",
    "4": "Step 4: Heart rate points for Rest are highlighted.",
    "5": "Step 5: Next, cognitive load (2‑Back) and physical load (Running) are revealed with their own colors.",
    "6": "Step 6: The chart is now fully interactive! Both heart rate and respiratory points are visible. Use the legend on the right to toggle query options."
  };

  // --- Data Loading & Combination ---
  // Include the new "Walking" CSV and limit each CSV to its first 100 rows.
  const dataPaths = [
    "data/sampled_2-Back.csv",
    "data/sampled_Rest.csv",
    "data/sampled_Running.csv",
    "data/sampled_Walking.csv"
  ];

  Promise.all(dataPaths.map(path => d3.csv(path)))
    .then(files => {
      // Combine CSV files into one dataset, using only the first 100 rows of each.
      let combinedData = [];
      files.forEach(dataArray => {
        dataArray.slice(0, 100).forEach(d => {
          const timestamp = +d.timestamp;
          const heartRate = +d.heart_rate;
          const breathingRate = +d.breathing_rate;
          const activity = d.activity; // "2-Back", "Rest", "Running", or "Walking"
          if (isNaN(timestamp) || isNaN(heartRate) || isNaN(breathingRate)) {
            console.warn("Skipping row due to NaN value:", d);
            return;
          }
          // Create one point for heart_rate.
          combinedData.push({
            timestamp: timestamp,
            activity: activity,
            measure: "heart_rate",
            value: heartRate
          });
          // And one for breathing_rate.
          combinedData.push({
            timestamp: timestamp,
            activity: activity,
            measure: "breathing_rate",
            value: breathingRate
          });
        });
      });
      console.log("Combined data points:", combinedData.length);

      // --- Set up SVG Dimensions ---
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

      // --- Scales & Axes ---
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

      // --- Zoom & Pan Setup (Final Interactive Mode) ---
      const zoomBehavior = d3.zoom()
        .scaleExtent([1, 20])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", (event) => {
          const transform = event.transform;
          const newXScale = transform.rescaleX(xScale);
          const newYScale = transform.rescaleY(yScale);
          points.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });
          chartArea.select(".x-axis")
            .call(xAxis.scale(newXScale));
          chartArea.select(".y-axis")
            .call(yAxis.scale(newYScale));
        });
      svg.on("dblclick", () => {
        svg.transition().duration(750)
          .call(zoomBehavior.transform, d3.zoomIdentity);
      });

      // --- Color Mapping ---
      const activityColors = {
        "Running": "#e41a1c",
        "Rest": "#377eb8",
        "2-Back": "#4daf4a",
        "Walking": "#ff7f00" // Orange for Walking.
      };

      // --- Plot Points ---
      const symbolGenerator = d3.symbol().size(64);
      const points = chartArea.selectAll(".point")
        .data(combinedData)
        .enter()
        .append("path")
        .attr("class", "point non-interactive")
        .attr("d", d => {
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
        .on("mouseover", function (event, d) {
          if (!interactiveActive) return;
          d3.select(this).classed("highlight", true);
          if (!tooltip) return;
          tooltip.style.opacity = 1;
          tooltip.innerHTML = `
            <strong>Activity:</strong> ${d.activity}<br/>
            <strong>Measure:</strong> ${d.measure}<br/>
            <strong>Value:</strong> ${d.value.toFixed(1)}<br/>
            <strong>Time:</strong> ${d.timestamp.toFixed(1)} s
          `;
        })
        .on("mousemove", function (event, d) {
          if (!interactiveActive) return;
          if (!tooltip) return;
          const [mx, my] = d3.pointer(event, plotContainer);
          tooltip.style.left = (mx + 15) + "px";
          tooltip.style.top = (my - 10) + "px";
        })
        .on("mouseout", function () {
          if (!interactiveActive) return;
          d3.select(this).classed("highlight", false);
          if (tooltip) tooltip.style.opacity = 0;
        });

      // --- Narrative & Heart Button (Click-to-Continue) Setup ---
      // Initialize currentStep at 0 so that the first click increments it to 1.
      let currentStep = 0;
      const totalSteps = 6;
      let interactiveActive = false; // becomes true at step 6.
      let clickEnabled = true; // prevents rapid clicks

      function updateNarrative(step) {
        if (narrativeContainer) {
          if (step === 0) {
            narrativeContainer.innerHTML = `<p>Click the heart to start the animation...</p>`;
          } else {
            narrativeContainer.innerHTML = `<p>${stepsText[step]}</p><p style="font-style: italic; color: var(--accent-color);">Click the heart to continue...</p>`;
          }
        }
        // Ensure heart button is visible (unless it's final step)
        if (heartButton && step < totalSteps) {
          heartButton.style.display = "block";
        }
      }
      updateNarrative(0);

      // --- Update Step Function ---
      function updateStep(step) {
        console.log("Running animation for step", step);
        switch (step) {
          case 1:
            // Step 1: All points gray.
            points.transition().duration(1000)
              .attr("fill", "gray")
              .attr("opacity", 0.8)
              .on("end", () => { updateNarrative(step); });
            break;
          case 2:
            // Step 2: Color by measure: heart_rate → red; breathing_rate → blue.
            points.transition().duration(1000)
              .attr("fill", d => d.measure === "heart_rate" ? "#d7191c" : "#2c7bb6")
              .on("end", () => { updateNarrative(step); });
            break;
          case 3:
            // Step 3: Hide respiratory (breathing_rate) points (opacity to 0) while keeping heart_rate visible.
            points.transition().duration(1000)
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 4:
            // Step 4: Highlight heart_rate points for "Rest".
            points.transition().duration(1000)
              .attr("fill", d => {
                if (d.measure === "heart_rate" && d.activity === "Rest") return "#377eb8";
                return "gray";
              })
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 5:
            // Step 5: Highlight heart_rate points for "2-Back" and "Running" loads.
            points.transition().duration(1000)
              .attr("fill", d => {
                if (d.measure === "heart_rate") {
                  if (d.activity === "2-Back") return "#4daf4a";
                  if (d.activity === "Running") return "#e41a1c";
                  if (d.activity === "Rest") return "#377eb8";
                }
                return "gray";
              })
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 6:
            // Step 6: Final interactive mode.
            // Bring respiratory (breathing_rate) points back (opacity to 0.8) and restore colors using shared activity mapping.
            points.transition().duration(1000)
              .attr("fill", d => activityColors[d.activity] || "gray")
              .attr("opacity", 0.8)
              .on("end", () => {
                updateNarrative(step);
                // Remove non-interactive restrictions.
                points.classed("non-interactive", false);
                // Activate zoom/pan.
                svg.call(zoomBehavior);
                interactiveActive = true;
                // Unhide the legend.
                if (legendContainer) {
                  legendContainer.style.display = "block";
                }
                // Hide heart button on final step.
                if (heartButton) {
                  heartButton.style.display = "none";
                }
              });
            break;
          default:
            break;
        }
      }

      // --- Heart Button Click Handler ---
      if (heartButton) {
        heartButton.addEventListener("click", () => {
          if (!clickEnabled) return;
          clickEnabled = false;
          // Add beat animation.
          heartButton.classList.add("beat");
          setTimeout(() => {
            heartButton.classList.remove("beat");
          }, 600);
          // Increment step and trigger update.
          currentStep++;
          updateStep(currentStep);
          // Wait for animation (transition duration plus a small buffer) before allowing next click.
          setTimeout(() => {
            clickEnabled = true;
            if (currentStep < totalSteps) {
              heartButton.style.display = "block";
            }
          }, 1100);
        });
      }

      // --- Legend Interactions ---
      // Activity checkboxes: control display and color of points
      d3.selectAll(".activity-checkbox").on("change", function () {
        if (interactiveActive) {
          const activity = this.value;
          // Update the label's background color
          const label = this.parentElement;
          if (this.checked) {
            label.style.backgroundColor = activityColors[activity];
            label.style.color = "#fff";
          } else {
            label.style.backgroundColor = "";
            label.style.color = "";
          }

          // Update points color
          points.attr("fill", d => {
            const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
            return (checkbox && checkbox.checked) ? (activityColors[d.activity] || "gray") : "gray";
          });
        }
      });

      // Measure checkboxes: control display of points based on measure and update y-axis
      d3.selectAll(".measure-checkbox").on("change", () => {
        if (interactiveActive) {
          // Update point visibility
          points.attr("display", d => {
            const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
            return (checkbox && checkbox.checked) ? null : "none";
          });

          // Get visible points based on checked measures
          const visiblePoints = combinedData.filter(d => {
            const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
            return checkbox && checkbox.checked;
          });

          // Calculate new y-axis extent based on visible points
          const newYExtent = d3.extent(visiblePoints, d => d.value);

          // Set y-axis range based on visible measures
          const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
          const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;

          let yMin, yMax;
          if (brChecked && !hrChecked) {
            // Only breathing rate visible
            yMin = 0;
            yMax = 60;
          } else if (hrChecked && !brChecked) {
            // Only heart rate visible
            yMin = 0;
            yMax = 200;
          } else if (hrChecked && brChecked) {
            // Both measures visible
            yMin = 0;
            yMax = 200;
          } else {
            // Neither checked (shouldn't happen in normal use)
            yMin = newYExtent[0] - 5;
            yMax = newYExtent[1] + 5;
          }

          // Update y scale
          yScale.domain([yMin, yMax]).nice();

          // Update points position
          points.transition()
            .duration(750)
            .attr("transform", d => {
              const tx = xScale(d.timestamp);
              const ty = yScale(d.value);
              return `translate(${tx},${ty})`;
            });

          // Update y-axis with animation
          chartArea.select(".y-axis")
            .transition()
            .duration(750)
            .call(yAxis);
        }
      });

      // --- Skip Animation Function ---
      function skipToInteractive() {
        // Reset any ongoing transitions
        points.interrupt();
        chartArea.selectAll(".y-axis").interrupt();

        // Jump to final state
        points
          .classed("non-interactive", false)
          .attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8)
          .attr("display", null);

        // Activate zoom/pan
        svg.call(zoomBehavior);
        interactiveActive = true;

        // Show legend
        if (legendContainer) {
          legendContainer.style.display = "block";
        }

        // Hide narrative and buttons
        if (narrativeContainer) {
          narrativeContainer.innerHTML = `<p>${stepsText[6]}</p>`;
        }
        if (heartButton) {
          heartButton.style.display = "none";
        }

        // Update current step
        currentStep = totalSteps;
      }

      // --- Skip Button Click Handler ---
      const skipButton = document.getElementById("skip-button");
      if (skipButton) {
        skipButton.addEventListener("click", skipToInteractive);
      }

    })
    .catch(error => {
      console.error("Error loading data:", error);
    });
});
