document.addEventListener("DOMContentLoaded", () => {
  // ========================
  // LIGHT/DARK MODE TOGGLE
  // ========================
  const toggleButton = document.getElementById("toggle-theme");
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  } else {
    console.warn("Toggle theme button not found in DOM.");
  }

  // ========================
  // TOOLTIP SETUP
  // ========================
  const plotContainer = document.getElementById("plot");
  let tooltip;
  if (plotContainer) {
    tooltip = document.createElement("div");
    tooltip.classList.add("tooltip");
    tooltip.style.opacity = 0;
    plotContainer.appendChild(tooltip);
  }

  // ========================
  // INTRO GAME VARIABLES
  // ========================
  const conditions = ["Rest", "2-Back", "Running"];
  let introGameActive = true;
  let introTimerStarted = false;
  let introTimerID;
  let introClickCount = 0;
  let currentConditionIndex = 0;
  let introTimeRemaining = 5; // seconds countdown

  // ========================
  // HEART BUTTON SETUP
  // ========================
  const heartButton = document.getElementById("heart-button");
  if (heartButton) {
    console.log("Heart button found:", heartButton);
    heartButton.style.display = "block";
  } else {
    console.warn("Heart button not found in DOM.");
  }

  // ========================
  // LEGEND & SLIDER SETUP
  // ========================
  const legendContainer = document.getElementById("legend");
  if (legendContainer) {
    legendContainer.style.display = "none"; // Hidden until interactive mode.
  }
  const legendToggle = document.getElementById("legend-toggle");
  if (legendToggle) {
    legendToggle.style.display = "none"; // Hidden until interactive mode.
    legendToggle.addEventListener("click", () => {
      if (legendContainer.style.display !== "none") {
        legendContainer.style.display = "none";
        legendToggle.innerHTML = "Show Legend";
      } else {
        legendContainer.style.display = "block";
        legendToggle.innerHTML = "Hide Legend";
      }
    });
  }
  let pointsToAdd = 100;
  const slider = document.getElementById("points-slider");
  const sliderValueLabel = document.getElementById("slider-value");
  const sliderLabel = document.getElementById("slider-label");
  if (slider) {
    slider.value = pointsToAdd;
    slider.addEventListener("input", () => {
      pointsToAdd = +slider.value;
      if (sliderValueLabel) {
        sliderValueLabel.textContent = slider.value;
      }
    });
  }

  // ========================
  // NARRATIVE SETUP
  // ========================
  const narrativeContainer = document.getElementById("narrative");
  const stepsText = {
    "1": "Step 1: The chart starts off with all data points in gray.",
    "2": "Step 2: Now the points separate by measure: heart rate turns red and respiratory rate turns blue.",
    "3": "Step 3: The respiratory (blue) points are hidden, leaving only heart rate visible.",
    "4": "Step 4: Heart rate points for Rest are highlighted.",
    "5": "Step 5: Next, cognitive load (2‑Back) and physical load (Running) are revealed with their own colors.",
    "6": "Step 6: The chart is now fully interactive! Both heart rate and respiratory points are visible. Use the legend to toggle query options."
  };

  // Global graph variables
  let svg, chartArea, xScale, yScale, zoomBehavior, yAxisLabel;
  let initialPoints, additionalPoints;
  let currentStep = 0;
  const totalSteps = 6;
  let interactiveActive = false;
  let clickEnabled = true;

  // ========================
  // NARRATIVE UPDATE FUNCTIONS
  // ========================
  function updateNarrative(text) {
    if (narrativeContainer) {
      narrativeContainer.innerHTML = `<p>${text}</p>`;
    }
  }
  function updateIntroNarrative() {
    updateNarrative(`Intro Game: For condition <strong>${conditions[currentConditionIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: ${introTimeRemaining} s. (Current count: ${introClickCount})`);
  }
  updateIntroNarrative();

  // ========================
  // PULSE DOT ANIMATION
  // ========================
  function pulseDot() {
    const heartRect = heartButton.getBoundingClientRect();
    const svgRect = svg.node().getBoundingClientRect();
    const cx = heartRect.left + heartRect.width / 2 - svgRect.left;
    const cy = heartRect.top + heartRect.height / 2 - svgRect.top;
    const dot = chartArea.append("circle")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", 5)
      .attr("fill", "#fff")
      .attr("opacity", 1);
    // Random angle & distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = 30 + Math.random() * 70;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    dot.transition()
      .duration(1000)
      .attr("cx", cx + dx)
      .attr("cy", cy + dy)
      .attr("opacity", 0)
      .remove();
  }

  // ========================
  // INTRO GAME TIMER
  // ========================
  function startIntroTimer() {
    introTimerStarted = true;
    updateIntroNarrative();
    introTimerID = setInterval(() => {
      introTimeRemaining--;
      updateIntroNarrative();
      if (introTimeRemaining <= 0) {
        clearInterval(introTimerID);
        // Cap predicted BPM at 200.
        const predictedHR = Math.min(introClickCount * 12, 200);
        console.log(`Prediction for ${conditions[currentConditionIndex]}: ${predictedHR} BPM`);
        // Draw a dashed prediction line with tooltip.
        const predLine = chartArea.append("line")
          .datum({ predictedHR })
          .attr("class", "prediction-line")
          .attr("x1", 0)
          .attr("y1", yScale(predictedHR))
          .attr("x2", xScale.range()[1])
          .attr("y2", yScale(predictedHR))
          .attr("stroke", activityColors[conditions[currentConditionIndex]] || "black")
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.8)
          .style("display", document.querySelector('.measure-checkbox[value="heart_rate"]').checked ? null : "none");
        // Add tooltip behavior to the prediction line.
        predLine.on("mouseover", function (event) {
          if (tooltip) {
            tooltip.style.opacity = 1;
            tooltip.innerHTML = `<strong>User estimated:</strong> ${predictedHR} BPM (${conditions[currentConditionIndex]})`;
          }
        }).on("mousemove", function (event) {
          if (tooltip) {
            const [mx, my] = d3.pointer(event, plotContainer);
            tooltip.style.left = (mx + 15) + "px";
            tooltip.style.top = (my - 10) + "px";
          }
        }).on("mouseout", function () {
          if (tooltip) tooltip.style.opacity = 0;
        });
        // Move to next condition.
        currentConditionIndex++;
        introClickCount = 0;
        introTimeRemaining = 5;
        introTimerStarted = false;
        if (currentConditionIndex < conditions.length) {
          updateNarrative(`Intro Game: For condition <strong>${conditions[currentConditionIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: 5 s. (Current count: 0)`);
        } else {
          introGameActive = false;
          updateNarrative("Intro game complete! Proceeding with the visualization animation...");
          setTimeout(() => {
            updateStep(1);
          }, 1000);
        }
      }
    }, 1000);
  }

  // ========================
  // DATA LOADING & REGRESSION
  // ========================
  const allDataPaths = [
    ...["data/sampled_2-Back.csv", "data/sampled_Rest.csv", "data/sampled_Running.csv", "data/sampled_Walking.csv"],
    ...["data/regression_2-Back_heart.csv", "data/regression_Rest_heart.csv", "data/regression_Running_heart.csv", "data/regression_Walking_heart.csv",
      "data/regression_2-Back_breathing.csv", "data/regression_Rest_breathing.csv", "data/regression_Running_breathing.csv", "data/regression_Walking_breathing.csv"]
  ];

  Promise.all(allDataPaths.map(path => d3.csv(path)))
    .then(files => {
      // Process original data (first 4 files)
      let fullData = [];
      files.slice(0, 4).forEach(dataArray => {
        fullData = fullData.concat(dataArray.slice(0, 100));
      });
      console.log("Full data rows:", fullData.length);
      fullData.forEach(d => {
        d.timestamp = +d.timestamp;
        d.heart_rate = +d.heart_rate;
        d.breathing_rate = +d.breathing_rate;
      });
      const fullDataExpanded = fullData.flatMap(d => [
        { ...d, measure: "heart_rate", value: d.heart_rate },
        { ...d, measure: "breathing_rate", value: d.breathing_rate }
      ]);
      console.log("Expanded data points:", fullDataExpanded.length);
      const groups = d3.group(fullDataExpanded, d => d.activity);
      let currentIndexByActivity = {};
      let initialDisplayedData = [];
      groups.forEach((arr, key) => {
        d3.shuffle(arr);
        currentIndexByActivity[key] = Math.min(100, arr.length);
        initialDisplayedData = initialDisplayedData.concat(arr.slice(0, currentIndexByActivity[key]));
      });
      console.log("Initial displayed points:", initialDisplayedData.length);

      // Process regression data (files 5-12)
      const regressionData = { heart_rate: {}, breathing_rate: {} };
      files.slice(4).forEach((dataArray, index) => {
        const parts = allDataPaths[index + 4].split('_'); // e.g., regression_2-Back_heart.csv
        const activity = parts[1];
        const measurePart = parts[2].split('.')[0]; // "heart" or "breathing"
        const measureKey = measurePart === "heart" ? "heart_rate" : "breathing_rate";
        regressionData[measureKey][activity] = dataArray.map(d => ({
          timestamp: +d.timestamp,
          predicted: measurePart === "heart" ? +d.predicted_heart_rate : +d.predicted_breathing_rate
        })).filter(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
      });

      // ========================
      // SVG SETUP
      // ========================
      const margin = { top: 20, right: 20, bottom: 60, left: 80 };
      const containerWidth = plotContainer.clientWidth || 600;
      const width = containerWidth - margin.left - margin.right;
      const height = 500 - margin.top - margin.bottom;
      svg = d3.select("#plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
      chartArea = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // ========================
      // SCALES & AXES
      // ========================
      xScale = d3.scaleLinear()
        .domain(d3.extent(fullDataExpanded, d => d.timestamp))
        .range([0, width])
        .nice();
      yScale = d3.scaleLinear()
        .domain([d3.extent(fullDataExpanded, d => d.value)[0] - 5, d3.extent(fullDataExpanded, d => d.value)[1] + 5])
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

      // Add Axis Labels
      chartArea.append("text")
        .attr("class", "x-axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Timestamp (seconds) across 5 minutes");
      yAxisLabel = chartArea.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .text("Heart Rate / Respiration Rate");

      // ========================
      // ZOOM & PAN SETUP
      // ========================
      zoomBehavior = d3.zoom()
        .scaleExtent([1, 20])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", (event) => {
          const transform = event.transform;
          const newXScale = transform.rescaleX(xScale);
          const newYScale = transform.rescaleY(yScale);
          initialPoints.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });
          additionalPoints.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });
          // Update regression lines as well.
          Object.entries(regressionData).forEach(([measure, activities]) => {
            Object.entries(activities).forEach(([activity, data]) => {
              const line = d3.line()
                .x(d => newXScale(d.timestamp))
                .y(d => newYScale(d.predicted))
                .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
              regressionGroups[measure].select(`.regression-line.${activity}`)
                .attr("d", line);
            });
          });
          chartArea.select(".x-axis").call(xAxis.scale(newXScale));
          chartArea.select(".y-axis").call(yAxis.scale(newYScale));
        });
      svg.on("dblclick", () => {
        svg.transition().duration(750)
          .call(zoomBehavior.transform, d3.zoomIdentity);
      });

      // ========================
      // COLOR MAPPING
      // ========================
      const activityColors = {
        "Running": "#e41a1c",
        "Rest": "#377eb8",
        "2-Back": "#4daf4a",
        "Walking": "#ff7f00"
      };

      // ========================
      // DRAW INITIAL POINTS
      // ========================
      const symbolGenerator = d3.symbol().size(64);
      initialPoints = chartArea.selectAll(".point.initial")
        .data(initialDisplayedData)
        .enter()
        .append("path")
        .attr("class", "point initial non-interactive")
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
        .attr("fill", d => activityColors[d.activity] || "gray")
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
      additionalPoints = chartArea.selectAll(".point.additional");

      // ========================
      // REGRESSION LINES SETUP
      // ========================
      const regressionGroups = {};
      ["heart_rate", "breathing_rate"].forEach(measure => {
        regressionGroups[measure] = chartArea.append("g")
          .attr("class", `regression-lines ${measure}`)
          .style("display", "none");
      });
      files.slice(4).forEach((dataArray, index) => {
        const parts = allDataPaths[index + 4].split('_'); // e.g., regression_2-Back_heart.csv
        const activity = parts[1];
        const measurePart = parts[2].split('.')[0]; // "heart" or "breathing"
        const measureKey = measurePart === "heart" ? "heart_rate" : "breathing_rate";
        const data = dataArray.map(d => ({
          timestamp: +d.timestamp,
          predicted: measurePart === "heart" ? +d.predicted_heart_rate : +d.predicted_breathing_rate
        })).filter(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
        if (!regressionData[measureKey][activity]) regressionData[measureKey][activity] = [];
        regressionData[measureKey][activity] = data;
      });
      Object.entries(regressionData).forEach(([measure, activities]) => {
        Object.entries(activities).forEach(([activity, data]) => {
          if (data.length === 0) return;
          data.sort((a, b) => a.timestamp - b.timestamp);
          const line = d3.line()
            .x(d => xScale(d.timestamp))
            .y(d => yScale(d.predicted))
            .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
          regressionGroups[measure].append("path")
            .datum(data)
            .attr("class", `regression-line ${activity}`)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", "gray")
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
        });
      });

      // Initialize activity checkboxes after data loading
      d3.selectAll(".activity-checkbox").each(function () {
        const activity = this.value;
        const label = this.parentElement;
        // Set checkbox to checked
        this.checked = true;
        // Update label style
        label.style.backgroundColor = activityColors[activity];
        label.style.color = "#fff";
      });

      // Update regression checkbox event handler
      d3.select(".regression-checkbox").on("change", function () {
        const checked = this.checked;
        const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
        const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;

        // Update heart rate regression lines
        if (checked && hrChecked) {
          const heartLine = d3.line()
            .x(d => xScale(d.timestamp))
            .y(d => yScale(d.predicted))
            .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));

          regressionGroups.heart_rate
            .style("display", "block")
            .selectAll(".regression-line")
            .each(function () {
              const activity = this.classList[1];
              // All activities are checked initially
              d3.select(this)
                .transition()
                .duration(750)
                .attr("d", heartLine)
                .attr("stroke", activityColors[activity]); // Always use activity color initially
            });
        } else {
          regressionGroups.heart_rate.style("display", "none");
        }

        // Update breathing rate regression lines
        if (checked && brChecked) {
          const breathingLine = d3.line()
            .x(d => xScale(d.timestamp))
            .y(d => yScale(d.predicted))
            .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));

          regressionGroups.breathing_rate
            .style("display", "block")
            .selectAll(".regression-line")
            .each(function () {
              const activity = this.classList[1];
              // All activities are checked initially
              d3.select(this)
                .transition()
                .duration(750)
                .attr("d", breathingLine)
                .attr("stroke", activityColors[activity]); // Always use activity color initially
            });
        } else {
          regressionGroups.breathing_rate.style("display", "none");
        }
      });

      // ========================
      // INTRO GAME & NARRATIVE
      // ========================
      function updateIntroNarrativeText() {
        updateNarrative(`Intro Game: For condition <strong>${conditions[currentConditionIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: ${introTimeRemaining} s. (Current count: ${introClickCount})`);
      }
      updateIntroNarrativeText();

      function startIntroTimer() {
        introTimerStarted = true;
        updateIntroNarrativeText();
        introTimerID = setInterval(() => {
          introTimeRemaining--;
          updateIntroNarrativeText();
          if (introTimeRemaining <= 0) {
            clearInterval(introTimerID);
            const predictedHR = Math.min(introClickCount * 12, 200);
            console.log(`Prediction for ${conditions[currentConditionIndex]}: ${predictedHR} BPM`);
            // Draw a dashed prediction line with a tooltip.
            const predLine = chartArea.append("line")
              .datum({ predictedHR })
              .attr("class", "prediction-line")
              .attr("x1", 0)
              .attr("y1", yScale(predictedHR))
              .attr("x2", xScale.range()[1])
              .attr("y2", yScale(predictedHR))
              .attr("stroke", activityColors[conditions[currentConditionIndex]] || "black")
              .attr("stroke-dasharray", "4,4")
              .attr("opacity", 0.8)
              .style("display", document.querySelector('.measure-checkbox[value="heart_rate"]').checked ? null : "none");
            predLine.on("mouseover", function (event) {
              if (tooltip) {
                tooltip.style.opacity = 1;
                tooltip.innerHTML = `<strong>User estimated:</strong> ${predictedHR} BPM (${conditions[currentConditionIndex]})`;
              }
            }).on("mousemove", function (event) {
              if (tooltip) {
                const [mx, my] = d3.pointer(event, plotContainer);
                tooltip.style.left = (mx + 15) + "px";
                tooltip.style.top = (my - 10) + "px";
              }
            }).on("mouseout", function () {
              if (tooltip) tooltip.style.opacity = 0;
            });
            currentConditionIndex++;
            introClickCount = 0;
            introTimeRemaining = 5;
            introTimerStarted = false;
            if (currentConditionIndex < conditions.length) {
              updateNarrative(`Intro Game: For condition <strong>${conditions[currentConditionIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: 5 s. (Current count: 0)`);
            } else {
              introGameActive = false;
              updateNarrative("Intro game complete! Proceeding with the visualization animation...");
              setTimeout(() => {
                updateStep(1);
              }, 1000);
            }
          }
        }, 1000);
      }

      // ========================
      // HEART BUTTON CLICK HANDLER
      // ========================
      heartButton.addEventListener("click", () => {
        // Always play pulse animation.
        pulseDot();
        // --- Intro Game Mode ---
        if (introGameActive) {
          if (!introTimerStarted) {
            startIntroTimer();
          }
          introClickCount++;
          updateIntroNarrativeText();
          return; // Exit to avoid running interactive mode.
        }
        // --- Interactive Mode ---
        if (!clickEnabled) return;
        clickEnabled = false;
        heartButton.classList.add("beat");
        setTimeout(() => {
          heartButton.classList.remove("beat");
        }, 600);
        if (currentStep < totalSteps) {
          currentStep++;
          updateStep(currentStep);
        } else if (interactiveActive) {
          // Instead of re-adding old points, sample new ones.
          addMorePoints();
        }
        setTimeout(() => {
          clickEnabled = true;
          if (currentStep < totalSteps) {
            heartButton.style.display = "block";
          }
        }, 1100);
      });

      // ========================
      // UPDATE STEP FUNCTION (Narrative Animation)
      // ========================
      function updateStep(step) {
        console.log("Running animation for step", step);
        switch (step) {
          case 1:
            initialPoints.transition().duration(1000)
              .attr("fill", "gray")
              .attr("opacity", 0.8)
              .on("end", () => { updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"); });
            break;
          case 2:
            initialPoints.transition().duration(1000)
              .attr("fill", d => d.measure === "heart_rate" ? "#d7191c" : "#2c7bb6")
              .on("end", () => { updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"); });
            break;
          case 3:
            initialPoints.transition().duration(1000)
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"); });
            break;
          case 4:
            initialPoints.transition().duration(1000)
              .attr("fill", d => (d.measure === "heart_rate" && d.activity === "Rest") ? "#377eb8" : "gray")
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"); });
            break;
          case 5:
            initialPoints.transition().duration(1000)
              .attr("fill", d => {
                if (d.measure === "heart_rate") {
                  if (d.activity === "2-Back") return "#4daf4a";
                  if (d.activity === "Running") return "#e41a1c";
                  if (d.activity === "Rest") return "#377eb8";
                }
                return "gray";
              })
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"); });
            break;
          case 6:
            initialPoints.transition().duration(1000)
              .attr("fill", d => activityColors[d.activity] || "gray")
              .attr("opacity", 0.8)
              .on("end", () => {
                updateNarrative(stepsText[step]);
                initialPoints.classed("non-interactive", false);
                svg.call(zoomBehavior);
                interactiveActive = true;
                if (legendContainer) {
                  legendContainer.style.display = "block";
                }
                if (slider) {
                  slider.style.display = "block";
                }
                if (sliderLabel) {
                  sliderLabel.style.display = "block";
                }
                if (legendToggle) {
                  legendToggle.style.display = "block";
                  legendToggle.innerHTML = "Hide Legend";
                }
                // Keep heart button visible for pumping points.
                if (heartButton) {
                  heartButton.style.display = "block";
                }
                updateYAxisLabel();
              });
            break;
          default:
            break;
        }
      }

      // ========================
      // AXIS LABEL UPDATE FUNCTION
      // ========================
      function updateYAxisLabel() {
        const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
        const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
        if (hrChecked && !brChecked) {
          yAxisLabel.text("Heart Rate (beats/min)");
        } else if (!hrChecked && brChecked) {
          yAxisLabel.text("Respiration Rate (breaths/min)");
        } else if (hrChecked && brChecked) {
          yAxisLabel.text("Heart Rate / Respiration Rate");
        } else {
          yAxisLabel.text("Rate");
        }
      }

      // ========================
      // FUNCTION TO ADD/REMOVE POINTS (Resampling New Points)
      // ========================
      function addMorePoints() {
        if (pointsToAdd >= 0) {
          // Sample new points from each group's remaining data.
          let heartRect = heartButton.getBoundingClientRect();
          let svgRect = svg.node().getBoundingClientRect();
          let startX = heartRect.left + heartRect.width / 2 - svgRect.left;
          let startY = heartRect.top + heartRect.height / 2 - svgRect.top;
          groups.forEach((arr, activity) => {
            let currentIndex = currentIndexByActivity[activity] || 0;
            if (currentIndex >= arr.length) return;
            let newIndex = Math.min(currentIndex + pointsToAdd, arr.length);
            let newPointsData = arr.slice(currentIndex, newIndex);
            // Update counter for this activity (do not decrement on removal).
            currentIndexByActivity[activity] = newIndex;
            newPointsData.forEach(d => {
              chartArea.append("path")
                .datum(d)
                .attr("class", "point additional")
                .attr("d", () => {
                  if (d.measure === "heart_rate") {
                    symbolGenerator.type(d3.symbolCircle);
                  } else {
                    symbolGenerator.type(d3.symbolSquare);
                  }
                  return symbolGenerator();
                })
                .attr("fill", activityColors[d.activity] || "gray")
                .attr("stroke", "none")
                .attr("opacity", 0)
                .attr("transform", `translate(${startX}, ${startY})`)
                .transition().duration(1000)
                .attr("opacity", 0.8)
                .attr("transform", `translate(${xScale(d.timestamp)}, ${yScale(d.value)})`);
            });
          });
          additionalPoints = chartArea.selectAll(".point.additional");
        } else {
          // Remove points: animate them sliding back to the heart.
          let numToRemove = Math.abs(pointsToAdd);
          let additionalNodes = chartArea.selectAll("path.point.additional").nodes();
          let heartRect = heartButton.getBoundingClientRect();
          let svgRect = svg.node().getBoundingClientRect();
          let heartX = heartRect.left + heartRect.width / 2 - svgRect.left;
          let heartY = heartRect.top + heartRect.height / 2 - svgRect.top;
          let nodesToRemove = additionalNodes.slice(-numToRemove);
          nodesToRemove.forEach(node => {
            d3.select(node)
              .transition()
              .duration(1000)
              .attr("transform", `translate(${heartX}, ${heartY})`)
              .style("opacity", 0)
              .remove();
            // Do not decrement currentIndexByActivity so new points come from later in the data.
          });
          additionalPoints = chartArea.selectAll("path.point.additional");
        }
      }

      // ========================
      // SKIP ANIMATION FUNCTION
      // ========================
      function skipToInteractive() {
        console.log("Skip animation button clicked");
        if (introGameActive) {
          clearInterval(introTimerID);
          introGameActive = false;
        }
        initialPoints.interrupt();
        additionalPoints.interrupt();
        initialPoints.classed("non-interactive", false)
          .attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8)
          .attr("display", null);
        additionalPoints.attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8)
          .attr("display", null);
        svg.call(zoomBehavior);
        interactiveActive = true;
        if (legendContainer) {
          legendContainer.style.display = "block";
        }
        if (slider) {
          slider.style.display = "block";
        }
        if (sliderLabel) {
          sliderLabel.style.display = "block";
        }
        if (legendToggle) {
          legendToggle.style.display = "block";
          legendToggle.innerHTML = "Hide Legend";
        }
        if (narrativeContainer) {
          narrativeContainer.innerHTML = `<p>${stepsText[6]}</p>`;
        }
        if (heartButton) {
          heartButton.style.display = "block";
        }
        currentStep = totalSteps;
        skipButton.disabled = true;
        skipButton.style.display = "none";
      }
      const skipButton = document.getElementById("skip-button");
      if (skipButton) {
        skipButton.addEventListener("click", skipToInteractive);
      }

      // ========================
      // LEGEND INTERACTIONS
      // ========================
      d3.selectAll(".activity-checkbox").on("change", function () {
        if (interactiveActive) {
          const activity = this.value;
          const label = this.parentElement;
          if (this.checked) {
            label.style.backgroundColor = activityColors[activity];
            label.style.color = "#fff";
          } else {
            label.style.backgroundColor = "";
            label.style.color = "";
          }
          initialPoints.attr("fill", d => {
            const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
            return (checkbox && checkbox.checked) ? (activityColors[d.activity] || "gray") : "gray";
          });
          d3.selectAll(".point.additional")
            .attr("fill", d => {
              const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
              return (checkbox && checkbox.checked) ? (activityColors[d.activity] || "gray") : "gray";
            });

          // Update regression lines color
          const showRegression = document.querySelector('.regression-checkbox').checked;
          if (showRegression) {
            ['heart_rate', 'breathing_rate'].forEach(measure => {
              regressionGroups[measure].selectAll(`.regression-line.${activity}`)
                .transition()
                .duration(750)
                .attr("stroke", this.checked ? activityColors[activity] : "gray");
            });
          }
        }
      });

      d3.selectAll(".measure-checkbox").on("change", () => {
        if (interactiveActive) {
          initialPoints.attr("display", d => {
            const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
            return (checkbox && checkbox.checked) ? null : "none";
          });
          d3.selectAll(".point.additional")
            .attr("display", d => {
              const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
              return (checkbox && checkbox.checked) ? null : "none";
            });
          const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
          const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
          let newYDomain;
          if (hrChecked && brChecked) {
            newYDomain = [0, 200];
          } else if (hrChecked && !brChecked) {
            const hrExtent = d3.extent(fullDataExpanded.filter(d => d.measure === "heart_rate"), d => d.value);
            newYDomain = [hrExtent[0] - 5, hrExtent[1] + 5];
          } else if (!hrChecked && brChecked) {
            const brExtent = d3.extent(fullDataExpanded.filter(d => d.measure === "breathing_rate"), d => d.value);
            newYDomain = [brExtent[0] - 5, brExtent[1] + 5];
          } else {
            newYDomain = yScale.domain();
          }
          yScale.domain(newYDomain).nice();
          updateYAxisLabel();
          initialPoints.transition().duration(750)
            .attr("transform", d => {
              const tx = xScale(d.timestamp);
              const ty = yScale(d.value);
              return `translate(${tx},${ty})`;
            });
          d3.selectAll(".point.additional").transition().duration(750)
            .attr("transform", d => {
              const tx = xScale(d.timestamp);
              const ty = yScale(d.value);
              return `translate(${tx},${ty})`;
            });
          chartArea.select(".y-axis")
            .transition().duration(750)
            .call(yAxis);

          // Update regression lines based on measure checkboxes
          const showRegression = document.querySelector('.regression-checkbox').checked;

          // Update heart rate regression lines
          if (showRegression && hrChecked) {
            const heartLine = d3.line()
              .x(d => xScale(d.timestamp))
              .y(d => yScale(d.predicted))
              .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));

            regressionGroups.heart_rate
              .style("display", "block")
              .selectAll(".regression-line")
              .each(function () {
                const activity = this.classList[1];
                const activityChecked = document.querySelector(`.activity-checkbox[value="${activity}"]`).checked;
                d3.select(this)
                  .transition()
                  .duration(750)
                  .attr("d", heartLine)
                  .attr("stroke", activityChecked ? activityColors[activity] : "gray");
              });
          } else {
            regressionGroups.heart_rate.style("display", "none");
          }

          // Update breathing rate regression lines
          if (showRegression && brChecked) {
            const breathingLine = d3.line()
              .x(d => xScale(d.timestamp))
              .y(d => yScale(d.predicted))
              .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));

            regressionGroups.breathing_rate
              .style("display", "block")
              .selectAll(".regression-line")
              .each(function () {
                const activity = this.classList[1];
                const activityChecked = document.querySelector(`.activity-checkbox[value="${activity}"]`).checked;
                d3.select(this)
                  .transition()
                  .duration(750)
                  .attr("d", breathingLine)
                  .attr("stroke", activityChecked ? activityColors[activity] : "gray");
              });
          } else {
            regressionGroups.breathing_rate.style("display", "none");
          }

          // Update intro game prediction lines
          chartArea.selectAll(".prediction-line")
            .style("display", hrChecked ? null : "none")
            .transition()
            .duration(750)
            .attr("y1", d => yScale(d.predictedHR))
            .attr("y2", d => yScale(d.predictedHR));
        }
      });
    })
    .catch(error => {
      console.error("Error loading data:", error);
    });
});
